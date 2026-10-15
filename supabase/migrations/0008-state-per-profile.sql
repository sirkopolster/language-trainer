-- 0008 · 2026-10-15 · learning state per learner (D-021): word_state keyed by (word, profile); admins learn on their own profile
alter table word_state add column if not exists profile_id uuid references profiles(id) on delete cascade;
-- backfill: existing rows belong to the profile that owns the word
update word_state ws set profile_id = t.profile_id
  from words w join units u on u.id = w.unit_id join tests t on t.id = u.test_id
  where w.id = ws.word_id and ws.profile_id is null;
alter table word_state alter column profile_id set not null;
alter table word_state drop constraint if exists word_state_pkey;
alter table word_state add primary key (word_id, profile_id);
create index if not exists word_state_profile_idx on word_state(profile_id);
drop policy if exists "word_state own" on word_state;
create policy "word_state own" on word_state for all to authenticated
  using (owns_profile(profile_id) and owns_word(word_id)) with check (owns_profile(profile_id) and owns_word(word_id));
