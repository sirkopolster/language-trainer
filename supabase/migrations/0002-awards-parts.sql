-- 0002 · 2026-10-13 · awards per lesson part (D-012): ref_id = unit, ref = 'lesson:<n>:<part>' or 'lesson:<n>', value = stars 0–3 (crown: 1)
alter table awards add column if not exists ref text not null default '';
alter table awards add column if not exists value smallint not null default 1 check (value between 0 and 3);
create unique index if not exists awards_unique_ref on awards(profile_id, kind, ref_id, ref);
