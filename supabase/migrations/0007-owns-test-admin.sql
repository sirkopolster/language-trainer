-- 0007 · 2026-10-15 · owns_test goes through owns_profile so the managing admin sees units, words, word_state and photos of a child (D-015 follow-up)
create or replace function owns_test(t uuid) returns boolean language sql security definer stable as $$
  select exists (select 1 from tests where tests.id = t and owns_profile(tests.profile_id));
$$;
