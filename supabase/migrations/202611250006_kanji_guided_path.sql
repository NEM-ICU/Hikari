-- Store each learner's guided JLPT level and tag pathway items for progression.
create table if not exists public.kanji_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_level smallint not null default 5 check (current_level between 1 and 5),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.kanji_profiles enable row level security;
grant select, insert, update, delete on public.kanji_profiles to authenticated;
drop policy if exists "Users manage their own kanji profile" on public.kanji_profiles;
create policy "Users manage their own kanji profile" on public.kanji_profiles
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.kanji_study_items
  add column if not exists curriculum_level smallint check (curriculum_level between 1 and 5);

alter table public.kanji_vocab_items
  add column if not exists curriculum_level smallint check (curriculum_level between 1 and 5);

create index if not exists kanji_study_items_user_curriculum_idx
  on public.kanji_study_items (user_id, curriculum_level, srs_stage);
create index if not exists kanji_vocab_items_user_curriculum_idx
  on public.kanji_vocab_items (user_id, curriculum_level, due_at);
