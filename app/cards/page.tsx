'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
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

const scheduler = fsrs({
  request_retention: 0.9,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
});
type CardFilter = 'all' | StudyCardType;
type CardEditDraft = {
  front: string;
  back: string;
  reading: string;
  meaning: string;
  breakdown: string;
  sentence_reading: string;
  sentence_translation: string;
  source_sentence: string;
};

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
  const [editingCard, setEditingCard] = useState<StudyCard | null>(null);
  const [editDraft, setEditDraft] = useState<CardEditDraft | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [error, setError] = useState('');
  const [clockNow, setClockNow] = useState(() => Date.now());

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
  const dueCards = filteredCards.filter((card) => new Date(card.due_at).getTime() <= clockNow);
  const nextDueCard = filteredCards
    .filter((card) => new Date(card.due_at).getTime() > clockNow)
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0] ?? null;
  const currentCard = dueCards[0] ?? null;
  const now = new Date(clockNow);

  useEffect(() => {
    if (!nextDueCard) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [nextDueCard?.due_at]);
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

  const startEditing = (card: StudyCard) => {
    setEditingCard(card);
    setEditDraft({
      front: card.front,
      back: card.back,
      reading: card.reading ?? '',
      meaning: card.meaning ?? '',
      breakdown: card.breakdown ?? '',
      sentence_reading: card.sentence_reading ?? '',
      sentence_translation: card.sentence_translation ?? '',
      source_sentence: card.source_sentence ?? '',
    });
    setEditError('');
  };

  const saveCardEdits = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client || !session || !editingCard || !editDraft || isSavingEdit) return;
    if (!editDraft.front.trim()) {
      setEditError('The card front cannot be empty.');
      return;
    }
    setIsSavingEdit(true);
    setEditError('');
    const changes = editingCard.card_type === 'sentence'
      ? {
          front: editDraft.front.trim(),
          back: editDraft.back.trim(),
          reading: editDraft.reading.trim() || null,
          sentence_reading: editDraft.reading.trim() || null,
          sentence_translation: editDraft.back.trim() || null,
          source_sentence: editDraft.front.trim() || null,
          updated_at: new Date().toISOString(),
        }
      : {
          front: editDraft.front.trim(),
          back: editDraft.meaning.trim(),
          reading: editDraft.reading.trim() || null,
          meaning: editDraft.meaning.trim() || null,
          breakdown: editDraft.breakdown.trim() || null,
          sentence_reading: editDraft.sentence_reading.trim() || null,
          sentence_translation: editDraft.sentence_translation.trim() || null,
          source_sentence: editDraft.source_sentence.trim() || null,
          updated_at: new Date().toISOString(),
        };
    const { data, error: updateError } = await client
      .from('study_cards')
      .update(changes)
      .eq('id', editingCard.id)
      .eq('user_id', session.user.id)
      .select('*')
      .single();
    if (updateError) setEditError(updateError.message);
    else {
      setCards((existing) => existing.map((card) => card.id === editingCard.id ? data as StudyCard : card));
      setEditingCard(null);
      setEditDraft(null);
    }
    setIsSavingEdit(false);
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
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => startEditing(currentCard)} className="text-xs text-amber-300 transition hover:text-amber-200">Edit card</button>
                  <button type="button" onClick={() => deleteCard(currentCard)} className="text-xs text-gray-600 transition hover:text-red-300">Delete card</button>
                </div>
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
              <h2 className="mt-5 text-xl font-semibold text-white">
                {filteredCards.length ? (nextDueCard ? 'Next card is learning' : 'You’re all caught up') : 'No cards in this deck yet'}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">
                {filteredCards.length
                  ? nextDueCard
                    ? `Your next learning card will return in ${formatInterval(new Date(nextDueCard.due_at), now)}. This page will bring it back automatically.`
                    : 'There are no cards due in this category. Come back when they are ready.'
                  : 'Mine a sentence in Sentence Mining, then save its sentence and vocabulary cards here.'}
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
          <div className="rounded-2xl border border-white/[0.08] bg-[#1d2028] p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wider text-gray-500">EDIT SAVED CARDS</p>
              <span className="text-[10px] text-gray-600">{filteredCards.length}</span>
            </div>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {filteredCards.map((card) => (
                <div key={card.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#15171d] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-200">{card.front}</p>
                    <p className="mt-0.5 text-[10px] capitalize text-gray-600">{card.card_type}</p>
                  </div>
                  <button type="button" onClick={() => startEditing(card)} className="shrink-0 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-300/10">Edit</button>
                </div>
              ))}
              {!filteredCards.length && <p className="py-4 text-center text-xs text-gray-600">No cards to edit.</p>}
            </div>
          </div>
        </aside>
      </div>
      {editingCard && editDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="edit-card-title" className="my-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-[#1d2028] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">{editingCard.card_type} card</p>
                <h2 id="edit-card-title" className="mt-1 text-xl font-semibold text-white">Edit card</h2>
              </div>
              <button type="button" onClick={() => { setEditingCard(null); setEditDraft(null); }} className="rounded-lg px-2 py-1 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Close edit card dialog">✕</button>
            </div>
            <form onSubmit={(event) => void saveCardEdits(event)} className="mt-5 space-y-4">
              {editingCard.card_type === 'sentence' ? (
                <>
                  <EditField label="Japanese sentence" value={editDraft.front} onChange={(front) => setEditDraft((draft) => draft ? { ...draft, front } : draft)} required rows={3} />
                  <EditField label="Translation" value={editDraft.back} onChange={(back) => setEditDraft((draft) => draft ? { ...draft, back } : draft)} rows={2} />
                  <EditField label="Sentence reading" value={editDraft.reading} onChange={(reading) => setEditDraft((draft) => draft ? { ...draft, reading } : draft)} rows={2} />
                </>
              ) : (
                <>
                  <EditField label="Word" value={editDraft.front} onChange={(front) => setEditDraft((draft) => draft ? { ...draft, front } : draft)} required />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <EditField label="Reading" value={editDraft.reading} onChange={(reading) => setEditDraft((draft) => draft ? { ...draft, reading } : draft)} />
                    <EditField label="Meaning" value={editDraft.meaning} onChange={(meaning) => setEditDraft((draft) => draft ? { ...draft, meaning } : draft)} />
                  </div>
                  <EditField label="Breakdown" value={editDraft.breakdown} onChange={(breakdown) => setEditDraft((draft) => draft ? { ...draft, breakdown } : draft)} rows={2} />
                  <details className="rounded-lg border border-white/[0.08] bg-[#15171d] px-3 py-2.5">
                    <summary className="cursor-pointer text-xs font-medium text-gray-400">Sentence context</summary>
                    <div className="mt-3 space-y-3">
                      <EditField label="Source sentence" value={editDraft.source_sentence} onChange={(source_sentence) => setEditDraft((draft) => draft ? { ...draft, source_sentence } : draft)} rows={2} />
                      <EditField label="Sentence reading" value={editDraft.sentence_reading} onChange={(sentence_reading) => setEditDraft((draft) => draft ? { ...draft, sentence_reading } : draft)} rows={2} />
                      <EditField label="Sentence translation" value={editDraft.sentence_translation} onChange={(sentence_translation) => setEditDraft((draft) => draft ? { ...draft, sentence_translation } : draft)} rows={2} />
                    </div>
                  </details>
                </>
              )}
              {editError && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/[0.07] px-3 py-2 text-sm text-red-200">{editError}</p>}
              <div className="flex justify-end gap-2 border-t border-white/[0.08] pt-4">
                <button type="button" onClick={() => { setEditingCard(null); setEditDraft(null); }} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:text-white">Cancel</button>
                <button type="submit" disabled={isSavingEdit} className="rounded-lg bg-[#fca311] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{isSavingEdit ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </StudyPageFrame>
  );
}

function EditField({ label, value, onChange, required = false, rows = 1 }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; rows?: number }) {
  const className = 'mt-1.5 w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-amber-300/40';
  return (
    <label className="block text-xs font-medium text-gray-400">
      {label}
      {rows > 1
        ? <textarea value={value} onChange={(event) => onChange(event.target.value)} required={required} rows={rows} className={className} />
        : <input value={value} onChange={(event) => onChange(event.target.value)} required={required} className={className} />}
    </label>
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
