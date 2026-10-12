-- 0001 · 2026-10-12 · SnapLearn initial schema (docs/data-model.md). Apply with: node scripts/sql.mjs < supabase/migrations/0001-init.sql
-- Ownership: every row belongs to a profile, every profile to auth.uid(). RLS checks ownership through profiles.

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  settings jsonb not null default '{"keep_photos": false}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists profiles_user_idx on profiles(user_id);

create table if not exists tests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  lang_from text not null default 'de',
  lang_to text not null default 'en',
  test_date date,
  format jsonb,
  status text not null default 'setup' check (status in ('setup','active','done')),
  created_at timestamptz not null default now()
);
create index if not exists tests_profile_idx on tests(profile_id);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  label text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists units_test_idx on units(test_id);

create table if not exists words (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  source text not null,
  target text not null,
  example text,
  priority boolean not null default false,
  status text not null default 'review' check (status in ('review','active','retired')),
  created_at timestamptz not null default now()
);
create index if not exists words_unit_idx on words(unit_id);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  kind text not null check (kind in ('vocab','test')),
  storage_path text not null,
  status text not null default 'uploaded' check (status in ('uploaded','extracted','failed','deleted')),
  extracted jsonb,
  created_at timestamptz not null default now()
);
create index if not exists photos_test_idx on photos(test_id);

create table if not exists word_state (
  word_id uuid primary key references words(id) on delete cascade,
  box smallint not null default 0 check (box between 0 and 5),
  due_at timestamptz not null default now(),
  streak smallint not null default 0,
  lapses smallint not null default 0,
  last_result boolean,
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('study','mock')),
  unit_id uuid references units(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  items jsonb not null default '[]'::jsonb,
  score numeric,
  max_score numeric
);
create index if not exists sessions_profile_idx on sessions(profile_id, started_at desc);

create table if not exists awards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('star','crown')),
  ref_id uuid,
  awarded_at timestamptz not null default now()
);
create index if not exists awards_profile_idx on awards(profile_id);

create table if not exists streaks (
  profile_id uuid primary key references profiles(id) on delete cascade,
  current int not null default 0,
  longest int not null default 0,
  last_day date
);

-- RLS: owner = auth.uid() via profiles
alter table profiles enable row level security;
alter table tests enable row level security;
alter table units enable row level security;
alter table words enable row level security;
alter table photos enable row level security;
alter table word_state enable row level security;
alter table sessions enable row level security;
alter table awards enable row level security;
alter table streaks enable row level security;

create or replace function owns_profile(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p and user_id = auth.uid());
$$;
create or replace function owns_test(t uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tests join profiles on profiles.id = tests.profile_id where tests.id = t and profiles.user_id = auth.uid());
$$;
create or replace function owns_unit(u uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from units where units.id = u and owns_test(units.test_id));
$$;
create or replace function owns_word(w uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from words where words.id = w and owns_unit(words.unit_id));
$$;

drop policy if exists "profiles own" on profiles;   create policy "profiles own"   on profiles   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "tests own" on tests;         create policy "tests own"      on tests      for all to authenticated using (owns_profile(profile_id)) with check (owns_profile(profile_id));
drop policy if exists "units own" on units;         create policy "units own"      on units      for all to authenticated using (owns_test(test_id)) with check (owns_test(test_id));
drop policy if exists "words own" on words;         create policy "words own"      on words      for all to authenticated using (owns_unit(unit_id)) with check (owns_unit(unit_id));
drop policy if exists "photos own" on photos;       create policy "photos own"     on photos     for all to authenticated using (owns_test(test_id)) with check (owns_test(test_id));
drop policy if exists "word_state own" on word_state; create policy "word_state own" on word_state for all to authenticated using (owns_word(word_id)) with check (owns_word(word_id));
drop policy if exists "sessions own" on sessions;   create policy "sessions own"   on sessions   for all to authenticated using (owns_profile(profile_id)) with check (owns_profile(profile_id));
drop policy if exists "awards own" on awards;       create policy "awards own"     on awards     for all to authenticated using (owns_profile(profile_id)) with check (owns_profile(profile_id));
drop policy if exists "streaks own" on streaks;     create policy "streaks own"    on streaks    for all to authenticated using (owns_profile(profile_id)) with check (owns_profile(profile_id));

-- Storage: private bucket, path <user_id>/<profile_id>/<file>
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
drop policy if exists "photos storage own" on storage.objects;
create policy "photos storage own" on storage.objects for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Audit log (blueprint §7): every change on data tables with the acting user
create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid,
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('insert','update','delete')),
  old jsonb,
  new jsonb
);
create index if not exists audit_log_at_idx on audit_log(at desc);
alter table audit_log enable row level security;
drop policy if exists "audit own" on audit_log; create policy "audit own" on audit_log for select to authenticated using (user_id = auth.uid());
create or replace function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then return new; end if;
  insert into audit_log (user_id, table_name, row_id, action, old, new) values (
    auth.uid(), tg_table_name, coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'word_id', '?'), lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','tests','units','words','photos','word_state','sessions','awards','streaks'] loop
    execute format('drop trigger if exists audit on %I', t);
    execute format('create trigger audit after insert or update or delete on %I for each row execute function audit_row()', t);
  end loop; end $$;
