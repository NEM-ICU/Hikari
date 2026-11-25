-- Add editable decomposition/mnemonics and vocabulary decks for jukugo practice.
alter table public.kanji_study_items
  add column if not exists components jsonb not null default '[]'::jsonb,
  add column if not exists mnemonic text not null default '';

create table if not exists public.kanji_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.kanji_decks enable row level security;
grant select, insert, update, delete on public.kanji_decks to authenticated;
create policy "Users manage their own kanji decks" on public.kanji_decks
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.kanji_vocab_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.kanji_decks(id) on delete cascade,
  word text not null,
  reading text not null default '',
  meanings text[] not null default '{}',
  source_kanji text,
  srs_stage smallint not null default 0 check (srs_stage between 0 and 8),
  due_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (deck_id, word, reading)
);

create index if not exists kanji_vocab_items_user_due_idx
  on public.kanji_vocab_items (user_id, deck_id, due_at asc);
alter table public.kanji_vocab_items enable row level security;
grant select, insert, update, delete on public.kanji_vocab_items to authenticated;
create policy "Users manage their own kanji vocabulary" on public.kanji_vocab_items
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
