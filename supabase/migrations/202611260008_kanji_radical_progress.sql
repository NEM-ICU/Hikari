-- Persist completion of the guided radical lessons by JLPT level.
alter table public.kanji_profiles
  add column if not exists radical_progress jsonb not null default '{}'::jsonb;
