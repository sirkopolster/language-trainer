-- 0006 · 2026-10-15 · special parts (D-020): a unit is vocab (DE↔EN pairs) or a generated grammar drill (tense = present↔past, negation = positive↔negative)
alter table units add column if not exists kind text not null default 'vocab' check (kind in ('vocab','tense','negation'));
