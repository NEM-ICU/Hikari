-- Extend kanji_study_items with richer reference data and user-editable fields.
alter table public.kanji_study_items
  add column if not exists name_readings text[] not null default '{}'::text[],
  add column if not exists heisig_en text,
  add column if not exists freq_mainichi_shinbun int,
  add column if not exists notes text[] not null default '{}'::text[],
  add column if not exists unicode text,
  add column if not exists meaning_note text,
  add column if not exists reading_note text,
  add column if not exists meaning_synonyms text[] not null default '{}'::text[];

-- Per-item aggregate review statistics, kept in sync by record_kanji_review.
create table if not exists public.kanji_review_stat (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.kanji_study_items(id) on delete cascade,
  meaning_correct integer not null default 0 check (meaning_correct >= 0),
  meaning_incorrect integer not null default 0 check (meaning_incorrect >= 0),
  reading_correct integer not null default 0 check (reading_correct >= 0),
  reading_incorrect integer not null default 0 check (reading_incorrect >= 0),
  meaning_current_streak integer not null default 0 check (meaning_current_streak >= 0),
  reading_current_streak integer not null default 0 check (reading_current_streak >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists kanji_review_stat_user_idx
  on public.kanji_review_stat (user_id, item_id);

alter table public.kanji_review_stat enable row level security;
grant select, insert, update on public.kanji_review_stat to authenticated;

drop policy if exists "Users can read their own kanji stats" on public.kanji_review_stat;
create policy "Users can read their own kanji stats"
  on public.kanji_review_stat for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own kanji stats" on public.kanji_review_stat;
create policy "Users can insert their own kanji stats"
  on public.kanji_review_stat for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own kanji stats" on public.kanji_review_stat;
create policy "Users can update their own kanji stats"
  on public.kanji_review_stat for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Replace record_kanji_review so it also maintains kanji_review_stat atomically.
create or replace function public.record_kanji_review(
  p_item_id uuid,
  p_prompt_type text,
  p_is_correct boolean,
  p_answer text,
  p_stage_before smallint,
  p_stage_after smallint,
  p_due_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_col_prefix text := p_prompt_type; -- 'meaning' or 'reading'
begin
  if p_prompt_type not in ('meaning', 'reading') then
    raise exception 'Invalid kanji review prompt';
  end if;
  if p_stage_before not between 0 and 8 or p_stage_after not between 0 and 8 then
    raise exception 'Invalid kanji SRS stage';
  end if;

  update public.kanji_study_items
  set srs_stage = p_stage_after,
      due_at = p_due_at,
      updated_at = now()
  where id = p_item_id
    and user_id = v_user_id
    and srs_stage = p_stage_before;

  if not found then
    raise exception 'Kanji item not found or its review state changed';
  end if;

  insert into public.kanji_review_log
    (user_id, item_id, prompt_type, is_correct, answer, stage_before, stage_after)
  values
    (v_user_id, p_item_id, p_prompt_type, p_is_correct, coalesce(p_answer, ''), p_stage_before, p_stage_after);

  -- Upsert aggregate stats. On conflict, bump counters and adjust the streak
  -- for the side that was just reviewed.
  insert into public.kanji_review_stat
    (user_id, item_id,
     meaning_correct, meaning_incorrect,
     reading_correct, reading_incorrect,
     meaning_current_streak, reading_current_streak,
     updated_at)
  values
    (v_user_id, p_item_id,
     case when p_prompt_type = 'meaning' and p_is_correct then 1 else 0 end,
     case when p_prompt_type = 'meaning' and not p_is_correct then 1 else 0 end,
     case when p_prompt_type = 'reading' and p_is_correct then 1 else 0 end,
     case when p_prompt_type = 'reading' and not p_is_correct then 1 else 0 end,
     case when p_prompt_type = 'meaning' and p_is_correct then 1 else 0 end,
     case when p_prompt_type = 'reading' and p_is_correct then 1 else 0 end,
     now())
  on conflict (user_id, item_id)
  do update set
    meaning_correct     = kanji_review_stat.meaning_correct
      + case when p_prompt_type = 'meaning' and p_is_correct then 1 else 0 end,
    meaning_incorrect   = kanji_review_stat.meaning_incorrect
      + case when p_prompt_type = 'meaning' and not p_is_correct then 1 else 0 end,
    reading_correct     = kanji_review_stat.reading_correct
      + case when p_prompt_type = 'reading' and p_is_correct then 1 else 0 end,
    reading_incorrect   = kanji_review_stat.reading_incorrect
      + case when p_prompt_type = 'reading' and not p_is_correct then 1 else 0 end,
    meaning_current_streak =
      case when p_prompt_type = 'meaning'
        then case when p_is_correct then kanji_review_stat.meaning_current_streak + 1 else 0 end
        else kanji_review_stat.meaning_current_streak end,
    reading_current_streak =
      case when p_prompt_type = 'reading'
        then case when p_is_correct then kanji_review_stat.reading_current_streak + 1 else 0 end
        else kanji_review_stat.reading_current_streak end,
    updated_at = now();
end;
$$;

grant execute on function public.record_kanji_review(uuid, text, boolean, text, smallint, smallint, timestamptz)
  to authenticated;

-- Unburn a burned kanji: return it to Apprentice 1 (stage 0), due now.
create or replace function public.unburn_kanji(p_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.kanji_study_items
  set srs_stage = 0,
      due_at = now(),
      updated_at = now()
  where id = p_item_id
    and user_id = (select auth.uid())
    and srs_stage = 8;

  if not found then
    raise exception 'Kanji item not found or is not burned';
  end if;
end;
$$;

grant execute on function public.unburn_kanji(uuid) to authenticated;

-- Save user-editable notes and custom meaning synonyms for a kanji item.
create or replace function public.save_kanji_notes(
  p_item_id uuid,
  p_meaning_note text,
  p_reading_note text,
  p_meaning_synonyms text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.kanji_study_items
  set meaning_note = nullif(trim(p_meaning_note), ''),
      reading_note = nullif(trim(p_reading_note), ''),
      meaning_synonyms = coalesce(p_meaning_synonyms, '{}'::text[]),
      updated_at = now()
  where id = p_item_id
    and user_id = (select auth.uid());

  if not found then
    raise exception 'Kanji item not found';
  end if;
end;
$$;

grant execute on function public.save_kanji_notes(uuid, text, text, text[])
  to authenticated;
