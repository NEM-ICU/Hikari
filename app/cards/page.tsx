'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fsrs, Rating, type CardInput } from 'ts-fsrs';
import EmailMagicLink from '@/components/EmailMagicLink';
import { useSupabaseSession } from '@/lib/useSupabaseSession';
import {
  deserializeFsrsCard,
  serializeFsrsCard,
  type StudyCard,
  type StudyCardType,
} from '@/lib/studyCards';

const StudyCardClip = dynamic(() => import('@/components/StudyCardClip'), {
  ssr: false,
  loading: () => <div className="mt-6 aspect-video w-full animate-pulse rounded-xl bg-white/[0.05]" />,
});

const scheduler = fsrs({ request_retention: 0.9 });
type CardFilter = 'all' | StudyCardType;

function formatInterval(due: Date, now: Date) {
  const minutes = Math.max(1, Math.ceil((due.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.ceil(hours / 24)}d`;
}

function getCardState(card: StudyCard): CardInput {
  return deserializeFsrsCard(card.fsrs_state ?? {});
}

export default function CardsPage() {
  const { client, session, loading: authLoading } = useSupabaseSession();
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [filter, setFilter] = useState<CardFilter>('all');
  const [revealed, setRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [error, setError] = useState('');

  const loadCards = useCallback(async () => {
    if (!client || !session) return;
    setIsLoading(true);
    setError('');
    const { data, error: loadError } = await client
      .from('study_cards')
      .select('*')
      .order('due_at', { ascending: true });
    if (loadError) setError(loadError.message);
    else setCards((data ?? []) as StudyCard[]);
    setIsLoading(false);
  }, [client, session]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const filteredCards = useMemo(
    () => cards.filter((card) => filter === 'all' || card.card_type === filter),
    [cards, filter]
  );
  const dueCards = filteredCards.filter((card) => new Date(card.due_at).getTime() <= Date.now());
  const currentCard = dueCards[0] ?? null;
  const now = new Date();
  const choices = currentCard
    ? scheduler.repeat(getCardState(currentCard), now)
    : null;

  const answer = async (rating: Rating) => {
    if (!client || !session || !currentCard || isAnswering) return;
    setIsAnswering(true);
    setError('');

    try {
      const result = scheduler.next(getCardState(currentCard), new Date(), rating);
      const nextState = serializeFsrsCard(result.card);
      const { error: saveError } = await client.rpc('record_card_review', {
        p_card_id: currentCard.id,
        p_rating: rating,
        p_fsrs_state: nextState,
        p_due_at: result.card.due.toISOString(),
        p_scheduled_days: result.log.scheduled_days,
      });
      if (saveError) throw saveError;

      setCards((existing) => existing.map((card) =>
        card.id === currentCard.id
          ? { ...card, fsrs_state: nextState as unknown as Record<string, unknown>, due_at: result.card.due.toISOString() }
          : card
      ));
      setRevealed(false);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not save your review.');
    } finally {
      setIsAnswering(false);
    }
  };

  const deleteCard = async (card: StudyCard) => {
    if (!client || !window.confirm('Delete this card and its review history?')) return;
    const { error: deleteError } = await client.from('study_cards').delete().eq('id', card.id);
    if (deleteError) setError(deleteError.message);
    else setCards((existing) => existing.filter((item) => item.id !== card.id));
  };

  if (!client) {
    return (
      <StudyPageFrame>
        <SetupMessage />
      </StudyPageFrame>
    );
  }

  if (authLoading) {
    return (
      <StudyPageFrame>
        <p className="py-24 text-center text-sm text-gray-400">Checking your library…</p>
      </StudyPageFrame>
    );
  }

  if (!session) {
    return (
      <StudyPageFrame>
        <section className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#1d2028] p-6 sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-300/10 text-2xl text-sky-200">▤</div>
            <h1 className="mt-5 text-2xl font-semibold text-white">Your card library</h1>
            <p className="mt-2 text-sm leading-6 text-gray-400">Sign in to review saved sentence and vocabulary cards across your devices.</p>
          </div>
          <div className="mt-6"><EmailMagicLink client={client} /></div>
        </section>
      </StudyPageFrame>
    );
  }

  const ratingOptions = [
    { rating: Rating.Again, label: 'Again', tone: 'border-rose-400/20 bg-rose-400/[0.08] text-rose-200 hover:bg-rose-400/15' },
    { rating: Rating.Hard, label: 'Hard', tone: 'border-orange-300/20 bg-orange-300/[0.08] text-orange-100 hover:bg-orange-300/15' },
    { rating: Rating.Good, label: 'Good', tone: 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100 hover:bg-emerald-300/15' },
    { rating: Rating.Easy, label: 'Easy', tone: 'border-sky-300/20 bg-sky-300/[0.08] text-sky-100 hover:bg-sky-300/15' },
  ];

  return (
    <StudyPageFrame>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-sky-200">YOUR STUDY DECK</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Card Learning</h1>
          <p className="mt-2 text-sm text-gray-400">Review at your pace. FSRS schedules the next time for each card.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{session.user.email}</span>
          <button
            type="button"
            onClick={() => client.auth.signOut()}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 transition hover:border-white/20 hover:text-white"
          >Sign out</button>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-xs text-gray-500">
          Select deck
          <select
            value={filter}
            onChange={(event) => { setFilter(event.target.value as CardFilter); setRevealed(false); }}
            className="rounded-lg border border-white/10 bg-[#1d2028] px-3 py-2 text-sm text-gray-200 outline-none focus:border-amber-300/50"
          >
            <option value="all">All Cards ({cards.length})</option>
            <option value="sentence">Sentence Deck ({cards.filter((card) => card.card_type === 'sentence').length})</option>
            <option value="vocabulary">Vocabulary Deck ({cards.filter((card) => card.card_type === 'vocabulary').length})</option>
          </select>
        </label>
        <button type="button" onClick={loadCards} className="text-xs text-gray-500 hover:text-white">Refresh</button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200">{error}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-h-[27rem] rounded-2xl border border-white/10 bg-[#1d2028] p-5 sm:p-8">
          {isLoading ? (
            <div className="flex min-h-[23rem] items-center justify-center text-sm text-gray-500">Loading your cards…</div>
          ) : currentCard ? (
            <div className="mx-auto flex min-h-[23rem] max-w-2xl flex-col">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${currentCard.card_type === 'sentence' ? 'bg-amber-300/10 text-amber-200' : 'bg-sky-300/10 text-sky-200'}`}>
                  {currentCard.card_type}
                </span>
                <button type="button" onClick={() => deleteCard(currentCard)} className="text-xs text-gray-600 transition hover:text-red-300">Delete card</button>
              </div>

              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <p className="whitespace-pre-wrap text-2xl font-medium leading-relaxed text-white sm:text-3xl">{currentCard.front}</p>
                {revealed && (
                  <div className="mt-8 w-full border-t border-white/[0.08] pt-6">
                    {currentCard.reading && <p className="text-lg text-amber-200">{currentCard.reading}</p>}
                    {currentCard.meaning && <p className="mt-2 text-lg text-white">{currentCard.meaning}</p>}
                    {currentCard.breakdown && <p className="mt-2 text-sm text-gray-400">{currentCard.breakdown}</p>}
                    {currentCard.card_type === 'sentence' && currentCard.back && <p className="mt-3 text-lg text-gray-200">{currentCard.back}</p>}
                    {currentCard.card_type === 'vocabulary' && currentCard.source_sentence && <p className="mt-5 text-sm leading-6 text-gray-400">{currentCard.source_sentence}</p>}
                    {currentCard.card_type === 'vocabulary' && currentCard.sentence_translation && <p className="mt-1 text-sm leading-6 text-gray-500">{currentCard.sentence_translation}</p>}
                    {currentCard.card_type === 'sentence' && currentCard.source_video_id && (
                      <StudyCardClip
                        key={currentCard.id}
                        videoId={currentCard.source_video_id}
                        startAt={currentCard.source_timestamp ?? 0}
                        endAt={currentCard.source_end_timestamp}
                      />
                    )}
                    {currentCard.card_type === 'sentence' && currentCard.source_video_id && (
                      <a
                        href={`https://youtu.be/${currentCard.source_video_id}?t=${currentCard.source_timestamp ?? 0}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-5 inline-flex text-xs text-amber-300 hover:text-amber-200"
                      >▶ Open source video at {currentCard.source_timestamp ?? 0}s</a>
                    )}
                  </div>
                )}
              </div>

              {!revealed ? (
                <button type="button" onClick={() => setRevealed(true)} className="w-full rounded-xl bg-[#fca311] px-5 py-3.5 text-sm font-semibold text-[#171717] transition hover:bg-amber-300">Show answer</button>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ratingOptions.map(({ rating, label, tone }) => {
                    const outcome = choices?.[rating];
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => answer(rating)}
                        disabled={isAnswering}
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold transition disabled:opacity-50 ${tone}`}
                      >
                        <span className="block">{label}</span>
                        {outcome && <span className="mt-1 block text-[10px] font-normal opacity-70">{formatInterval(outcome.card.due, now)}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[23rem] flex-col items-center justify-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-300/10 text-2xl text-emerald-200">✓</span>
              <h2 className="mt-5 text-xl font-semibold text-white">{filteredCards.length ? 'You’re all caught up' : 'No cards in this deck yet'}</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">
                {filteredCards.length ? 'There are no cards due in this category. Come back when they are ready.' : 'Mine a sentence in Sentence Mining, then save its sentence and vocabulary cards here.'}
              </p>
              {!filteredCards.length && <Link href="/sentence-mining" className="mt-5 rounded-lg bg-[#fca311] px-4 py-2.5 text-sm font-semibold text-[#171717] hover:bg-amber-300">Go to Sentence Mining</Link>}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#1d2028] p-5">
            <p className="text-xs font-semibold tracking-wider text-gray-500">TODAY</p>
            <p className="mt-3 text-3xl font-semibold text-white">{dueCards.length}</p>
            <p className="mt-1 text-sm text-gray-500">cards due to review</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#1d2028] p-5">
            <p className="text-xs font-semibold tracking-wider text-gray-500">YOUR LIBRARY</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Sentence cards</span><span className="text-white">{cards.filter((card) => card.card_type === 'sentence').length}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Vocabulary cards</span><span className="text-white">{cards.filter((card) => card.card_type === 'vocabulary').length}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </StudyPageFrame>
  );
}

function StudyPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#15171d] px-4 py-6 text-gray-100 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-white"><span aria-hidden="true">←</span> Hikari home</Link>
        {children}
      </div>
    </main>
  );
}

function SetupMessage() {
  return (
    <section className="mx-auto mt-16 max-w-xl rounded-2xl border border-white/10 bg-[#1d2028] p-6 sm:p-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-amber-300">DATABASE SETUP</p>
      <h1 className="mt-3 text-2xl font-semibold text-white">Connect your Supabase project</h1>
      <p className="mt-3 text-sm leading-6 text-gray-400">Add the project URL and public anon key to <code className="rounded bg-black/30 px-1.5 py-0.5 text-amber-200">.env.local</code>, then apply the SQL migration in the Supabase SQL Editor.</p>
      <pre className="mt-5 overflow-x-auto rounded-xl bg-[#15171d] p-4 text-xs leading-6 text-gray-300">{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key`}</pre>
    </section>
  );
}
