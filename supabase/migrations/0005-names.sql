-- 0005 · 2026-10-14 · admin display name, unique names (login with name or e-mail, D-016)
alter table admins add column if not exists name text not null default 'Eltern';
drop policy if exists "admins self update" on admins;
create policy "admins self update" on admins for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create unique index if not exists profiles_name_unique on profiles (lower(name));
create unique index if not exists admins_name_unique on admins (lower(name));
