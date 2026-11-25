create extension if not exists pgcrypto;

create table if not exists public.study_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_type text not null check (card_type in ('sentence', 'vocabulary')),
  front text not null,
  back text not null,
  reading text,
  meaning text,
  breakdown text,
  sentence_reading text,
  sentence_translation text,
  source_sentence text,
  source_video_id text,
  source_timestamp double precision,
  source_end_timestamp double precision,
  fsrs_state jsonb not null default '{}'::jsonb,
  due_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_cards
  add column if not exists source_end_timestamp double precision;

alter table public.study_cards
  alter column source_timestamp type double precision
    using source_timestamp::double precision,
  alter column source_end_timestamp type double precision
    using source_end_timestamp::double precision;

create index if not exists study_cards_user_due_idx
  on public.study_cards (user_id, due_at asc);

create index if not exists study_cards_user_type_idx
  on public.study_cards (user_id, card_type, created_at desc);

alter table public.study_cards enable row level security;
grant select, insert, update, delete on public.study_cards to authenticated;

drop policy if exists "Users can read their own study cards" on public.study_cards;
create policy "Users can read their own study cards"
  on public.study_cards for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own study cards" on public.study_cards;
create policy "Users can create their own study cards"
  on public.study_cards for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own study cards" on public.study_cards;
create policy "Users can update their own study cards"
  on public.study_cards for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own study cards" on public.study_cards;
create policy "Users can delete their own study cards"
  on public.study_cards for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.card_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.study_cards(id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),
  reviewed_at timestamptz not null default now(),
  scheduled_days integer not null default 0 check (scheduled_days >= 0),
  fsrs_state jsonb not null
);

create index if not exists card_reviews_user_reviewed_idx
  on public.card_reviews (user_id, reviewed_at desc);

alter table public.card_reviews enable row level security;
grant select, insert on public.card_reviews to authenticated;

drop policy if exists "Users can read their own card reviews" on public.card_reviews;
create policy "Users can read their own card reviews"
  on public.card_reviews for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create reviews for their own cards" on public.card_reviews;
create policy "Users can create reviews for their own cards"
  on public.card_reviews for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.study_cards
      where study_cards.id = card_id
        and study_cards.user_id = (select auth.uid())
    )
  );

create or replace function public.record_card_review(
  p_card_id uuid,
  p_rating smallint,
  p_fsrs_state jsonb,
  p_due_at timestamptz,
  p_scheduled_days integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_rating not between 1 and 4 then
    raise exception 'Rating must be between 1 and 4';
  end if;

  update public.study_cards
  set fsrs_state = p_fsrs_state,
      due_at = p_due_at,
      updated_at = now()
  where id = p_card_id
    and user_id = (select auth.uid());

  if not found then
    raise exception 'Study card not found';
  end if;

  insert into public.card_reviews (user_id, card_id, rating, scheduled_days, fsrs_state)
  values ((select auth.uid()), p_card_id, p_rating, p_scheduled_days, p_fsrs_state);
end;
$$;

grant execute on function public.record_card_review(uuid, smallint, jsonb, timestamptz, integer)
  to authenticated;
