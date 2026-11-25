-- A kanji review is one session containing both a meaning and a reading check.
create or replace function public.record_kanji_review_session(
  p_item_id uuid,
  p_meaning_answer text,
  p_meaning_correct boolean,
  p_reading_answer text,
  p_reading_correct boolean,
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
  v_prompt record;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
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
    (v_user_id, p_item_id, 'meaning', p_meaning_correct, coalesce(p_meaning_answer, ''), p_stage_before, p_stage_after),
    (v_user_id, p_item_id, 'reading', p_reading_correct, coalesce(p_reading_answer, ''), p_stage_before, p_stage_after);

  for v_prompt in
    select * from (values
      ('meaning'::text, p_meaning_correct),
      ('reading'::text, p_reading_correct)
    ) as prompts(prompt_type, is_correct)
  loop
    insert into public.kanji_review_stat
      (user_id, item_id, meaning_correct, meaning_incorrect, reading_correct,
       reading_incorrect, meaning_current_streak, reading_current_streak, updated_at)
    values (
      v_user_id, p_item_id,
      case when v_prompt.prompt_type = 'meaning' and v_prompt.is_correct then 1 else 0 end,
      case when v_prompt.prompt_type = 'meaning' and not v_prompt.is_correct then 1 else 0 end,
      case when v_prompt.prompt_type = 'reading' and v_prompt.is_correct then 1 else 0 end,
      case when v_prompt.prompt_type = 'reading' and not v_prompt.is_correct then 1 else 0 end,
      case when v_prompt.prompt_type = 'meaning' and v_prompt.is_correct then 1 else 0 end,
      case when v_prompt.prompt_type = 'reading' and v_prompt.is_correct then 1 else 0 end,
      now()
    )
    on conflict (user_id, item_id) do update set
      meaning_correct = kanji_review_stat.meaning_correct
        + case when v_prompt.prompt_type = 'meaning' and v_prompt.is_correct then 1 else 0 end,
      meaning_incorrect = kanji_review_stat.meaning_incorrect
        + case when v_prompt.prompt_type = 'meaning' and not v_prompt.is_correct then 1 else 0 end,
      reading_correct = kanji_review_stat.reading_correct
        + case when v_prompt.prompt_type = 'reading' and v_prompt.is_correct then 1 else 0 end,
      reading_incorrect = kanji_review_stat.reading_incorrect
        + case when v_prompt.prompt_type = 'reading' and not v_prompt.is_correct then 1 else 0 end,
      meaning_current_streak = case when v_prompt.prompt_type = 'meaning'
        then case when v_prompt.is_correct then kanji_review_stat.meaning_current_streak + 1 else 0 end
        else kanji_review_stat.meaning_current_streak end,
      reading_current_streak = case when v_prompt.prompt_type = 'reading'
        then case when v_prompt.is_correct then kanji_review_stat.reading_current_streak + 1 else 0 end
        else kanji_review_stat.reading_current_streak end,
      updated_at = now();
  end loop;
end;
$$;

grant execute on function public.record_kanji_review_session(uuid, text, boolean, text, boolean, smallint, smallint, timestamptz)
  to authenticated;
