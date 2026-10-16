-- 0009 · 2026-10-16 · real test result (D-022): "x von y" entered by the learner after the test day
alter table tests add column if not exists result_score numeric;
alter table tests add column if not exists result_max numeric;
alter table tests add constraint tests_result_check check ((result_score is null) = (result_max is null) and (result_max is null or (result_max > 0 and result_score >= 0 and result_score <= result_max)));
