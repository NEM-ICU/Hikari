create table if not exists public.kanji_study_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kanji text not null,
  meanings text[] not null default '{}',
  on_readings text[] not null default '{}',
  kun_readings text[] not null default '{}',
  grade smallint,
  jlpt smallint,
  stroke_count smallint,
  srs_stage smallint not null default -1 check (srs_stage between -1 and 8),
  due_at timestamptz not null default now(),
  lesson_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kanji)
);

create index if not exists kanji_study_items_user_due_idx
  on public.kanji_study_items (user_id, due_at asc);

create index if not exists kanji_study_items_user_stage_idx
  on public.kanji_study_items (user_id, srs_stage, due_at asc);

alter table public.kanji_study_items enable row level security;
grant select, insert, update, delete on public.kanji_study_items to authenticated;

drop policy if exists "Users can read their own kanji items" on public.kanji_study_items;
create policy "Users can read their own kanji items"
  on public.kanji_study_items for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own kanji items" on public.kanji_study_items;
create policy "Users can add their own kanji items"
  on public.kanji_study_items for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own kanji items" on public.kanji_study_items;
create policy "Users can update their own kanji items"
  on public.kanji_study_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own kanji items" on public.kanji_study_items;
create policy "Users can delete their own kanji items"
  on public.kanji_study_items for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.kanji_review_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.kanji_study_items(id) on delete cascade,
  prompt_type text not null check (prompt_type in ('meaning', 'reading')),
  is_correct boolean not null,
  answer text not null default '',
  stage_before smallint not null check (stage_before between 0 and 8),
  stage_after smallint not null check (stage_after between 0 and 8),
  reviewed_at timestamptz not null default now()
);

create index if not exists kanji_review_log_user_reviewed_idx
  on public.kanji_review_log (user_id, reviewed_at desc);

alter table public.kanji_review_log enable row level security;
grant select, insert on public.kanji_review_log to authenticated;

drop policy if exists "Users can read their own kanji reviews" on public.kanji_review_log;
create policy "Users can read their own kanji reviews"
  on public.kanji_review_log for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create reviews for their own kanji items" on public.kanji_review_log;
create policy "Users can create reviews for their own kanji items"
  on public.kanji_review_log for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.kanji_study_items
      where kanji_study_items.id = item_id
        and kanji_study_items.user_id = (select auth.uid())
    )
  );

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
    and user_id = (select auth.uid())
    and srs_stage = p_stage_before;

  if not found then
    raise exception 'Kanji item not found or its review state changed';
  end if;

  insert into public.kanji_review_log
    (user_id, item_id, prompt_type, is_correct, answer, stage_before, stage_after)
  values
    ((select auth.uid()), p_item_id, p_prompt_type, p_is_correct, coalesce(p_answer, ''), p_stage_before, p_stage_after);
end;
$$;

grant execute on function public.record_kanji_review(uuid, text, boolean, text, smallint, smallint, timestamptz)
  to authenticated;
