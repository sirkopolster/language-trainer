-- 0004 · 2026-10-14 · roles (D-015): admins (parents) manage student accounts; a profile belongs to its student (user_id) and is visible to its admin (admin_id)
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;
drop policy if exists "admins self" on admins;
create policy "admins self" on admins for select to authenticated using (user_id = auth.uid());

alter table profiles add column if not exists admin_id uuid references auth.users(id) on delete set null;
create index if not exists profiles_admin_idx on profiles(admin_id);

create or replace function is_admin() returns boolean language sql security definer stable as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ownership now includes the managing admin; every other table's policy goes through owns_profile
create or replace function owns_profile(p uuid) returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = p and (user_id = auth.uid() or admin_id = auth.uid()));
$$;
drop policy if exists "profiles own" on profiles;
create policy "profiles own" on profiles for all to authenticated
  using (user_id = auth.uid() or admin_id = auth.uid())
  with check (user_id = auth.uid() or admin_id = auth.uid());
alter table profiles add column if not exists email text; -- login e-mail of the student, kept by the admin function so the parent can see it
