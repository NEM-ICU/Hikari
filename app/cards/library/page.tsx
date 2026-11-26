'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import EmailMagicLink from '@/components/EmailMagicLink';
import { useSupabaseSession } from '@/lib/useSupabaseSession';
import type { StudyCard, StudyCardType } from '@/lib/studyCards';

type CardFilter = 'all' | StudyCardType;
type Draft = { front: string; back: string; reading: string; breakdown: string };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export default function CardLibraryPage() {
  const { client, session, loading: authLoading } = useSupabaseSession();
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CardFilter>('all');
  const [editing, setEditing] = useState<StudyCard | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const loadCards = useCallback(async () => {
    if (!client || !session) return;
    setLoading(true);
    setError('');
    const { data, error: loadError } = await client.from('study_cards').select('*').order('created_at', { ascending: false });
    if (loadError) setError(loadError.message);
    else setCards((data ?? []) as StudyCard[]);
    setLoading(false);
  }, [client, session]);

  useEffect(() => { void loadCards(); }, [loadCards]);

  const visibleCards = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return cards.filter((card) => {
      if (filter !== 'all' && card.card_type !== filter) return false;
      if (!normalizedQuery) return true;
      return [card.front, card.back, card.reading, card.meaning, card.breakdown, card.sentence_translation, card.source_sentence]
        .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [cards, filter, query]);

  const startEditing = (card: StudyCard) => {
    setEditing(card);
    setEditError('');
    setDraft({ front: card.front, back: card.back, reading: card.reading ?? '', breakdown: card.breakdown ?? '' });
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client || !session || !editing || !draft || saving) return;
    if (!draft.front.trim()) { setEditError('The card front cannot be empty.'); return; }
    setSaving(true);
    setEditError('');
    const changes = editing.card_type === 'sentence'
      ? { front: draft.front.trim(), back: draft.back.trim(), reading: draft.reading.trim() || null, sentence_reading: draft.reading.trim() || null, sentence_translation: draft.back.trim() || null, source_sentence: draft.front.trim(), updated_at: new Date().toISOString() }
      : { front: draft.front.trim(), back: draft.back.trim(), meaning: draft.back.trim() || null, reading: draft.reading.trim() || null, breakdown: draft.breakdown.trim() || null, updated_at: new Date().toISOString() };
    const { data, error: updateError } = await client.from('study_cards').update(changes).eq('id', editing.id).eq('user_id', session.user.id).select('*').single();
    if (updateError) setEditError(updateError.message);
    else {
      setCards((existing) => existing.map((card) => card.id === editing.id ? data as StudyCard : card));
      setEditing(null);
      setDraft(null);
    }
    setSaving(false);
  };

  const deleteCard = async (card: StudyCard) => {
    if (!client || !session || !window.confirm('Delete this card and its review history?')) return;
    const { error: deleteError } = await client.from('study_cards').delete().eq('id', card.id).eq('user_id', session.user.id);
    if (deleteError) setError(deleteError.message);
    else setCards((existing) => existing.filter((item) => item.id !== card.id));
  };

  if (!client) return <LibraryFrame><SetupMessage /></LibraryFrame>;
  if (authLoading) return <LibraryFrame><p className="py-16 text-center text-sm text-gray-500">Loading your card library…</p></LibraryFrame>;
  if (!session) return <LibraryFrame><section className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#1d2028] p-6"><h1 className="text-xl font-semibold text-white">Your saved cards</h1><p className="mt-2 text-sm leading-6 text-gray-400">Sign in to browse the cards saved to your library.</p><div className="mt-5"><EmailMagicLink client={client} /></div></section></LibraryFrame>;

  return <LibraryFrame>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Link href="/cards" className="rounded-lg px-2 py-1.5 text-sm text-gray-500 transition hover:bg-white/5 hover:text-white">← Review</Link>
        <h1 className="text-xl font-semibold text-white">Saved cards <span className="text-sm font-normal text-gray-500">{visibleCards.length}/{cards.length}</span></h1>
      </div>
      <button type="button" onClick={() => void loadCards()} aria-label="Refresh card library" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-base text-gray-500 transition hover:bg-white/5 hover:text-white">↻</button>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <label>
        <span className="sr-only">Search saved cards</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cards, readings, meanings…" className="w-full rounded-lg border border-white/10 bg-[#1d2028] px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-500 focus:border-amber-300/50" />
      </label>
      <label>
        <span className="sr-only">Filter by card type</span>
        <select value={filter} onChange={(event) => setFilter(event.target.value as CardFilter)} className="w-full rounded-lg border border-white/10 bg-[#1d2028] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-300/50 sm:w-auto">
          <option value="all">All types</option><option value="sentence">Sentences</option><option value="vocabulary">Vocabulary</option>
        </select>
      </label>
    </div>

    {error && <p role="alert" className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.07] px-3 py-2 text-sm text-red-200">{error}</p>}
    {loading ? <p className="py-16 text-center text-sm text-gray-500">Loading saved cards…</p> : visibleCards.length ? <div className="mt-4 space-y-2">
      {visibleCards.map((card) => <article key={card.id} className="rounded-xl border border-white/10 bg-[#1d2028] px-4 py-3 transition hover:border-white/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${card.card_type === 'sentence' ? 'bg-amber-300/10 text-amber-200' : 'bg-sky-300/10 text-sky-200'}`}>{card.card_type}</span>
              <span className="text-[11px] text-gray-600">Saved {dateLabel(card.created_at)}</span>
            </div>
            <p className="whitespace-pre-wrap text-base font-medium leading-6 text-white">{card.front}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-400">
              {card.reading && <span>{card.reading}</span>}
              {(card.meaning || card.back) && <span>{card.meaning || card.back}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => startEditing(card)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-300/10">Edit</button>
            <button type="button" onClick={() => void deleteCard(card)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-red-400/10 hover:text-red-200">Delete</button>
          </div>
        </div>
        <details className="mt-2 border-t border-white/[0.06] pt-2">
          <summary className="w-fit cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-300">Card details</summary>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            {card.breakdown && <Detail label="Breakdown" value={card.breakdown} />}
            {card.card_type === 'sentence' && card.back && <Detail label="Translation" value={card.back} />}
            {card.sentence_translation && card.card_type === 'vocabulary' && <Detail label="Sentence translation" value={card.sentence_translation} />}
            {card.source_sentence && card.card_type === 'vocabulary' && <Detail label="Source sentence" value={card.source_sentence} />}
            {card.source_video_id && <a className="text-xs font-medium text-sky-300 underline underline-offset-2 hover:text-sky-200" href={`https://youtu.be/${card.source_video_id}?t=${card.source_timestamp ?? 0}`} target="_blank" rel="noreferrer">Open source video</a>}
          </div>
        </details>
      </article>)}
    </div> : <section className="mt-4 rounded-2xl border border-dashed border-white/15 px-5 py-14 text-center">
      <p className="text-lg font-semibold text-white">{query || filter !== 'all' ? 'No cards match this search' : 'No saved cards yet'}</p>
      <p className="mt-2 text-sm text-gray-500">{query || filter !== 'all' ? 'Try a different search or card type.' : 'Save a sentence or vocabulary card from Sentence Mining to see it here.'}</p>
      {!cards.length && <Link href="/sentence-mining" className="mt-4 inline-flex rounded-lg bg-[#fca311] px-3 py-2 text-sm font-semibold text-black">Open Sentence Mining</Link>}
    </section>}

    {editing && draft && <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/60 p-4" onKeyDown={(event) => { if (event.key === 'Escape') { setEditing(null); setDraft(null); } }} onMouseDown={(event) => { if (event.target === event.currentTarget) { setEditing(null); setDraft(null); } }}>
      <section role="dialog" aria-modal="true" aria-labelledby="library-edit-title" className="my-auto w-full max-w-lg rounded-2xl border border-white/10 bg-[#1d2028] p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">{editing.card_type}</p><h2 id="library-edit-title" className="mt-1 text-lg font-semibold text-white">Edit saved card</h2></div><button type="button" onClick={() => { setEditing(null); setDraft(null); }} aria-label="Close edit form" className="rounded-lg px-2 py-1 text-gray-400 hover:bg-white/5 hover:text-white">×</button></div>
        <form onSubmit={(event) => void saveEdit(event)} className="mt-4 space-y-3">
          <EditField label={editing.card_type === 'sentence' ? 'Japanese sentence' : 'Word'} value={draft.front} onChange={(front) => setDraft((current) => current ? { ...current, front } : current)} />
          <EditField label={editing.card_type === 'sentence' ? 'Translation' : 'Meaning'} value={draft.back} onChange={(back) => setDraft((current) => current ? { ...current, back } : current)} />
          <EditField label="Reading" value={draft.reading} onChange={(reading) => setDraft((current) => current ? { ...current, reading } : current)} />
          {editing.card_type === 'vocabulary' && <EditField label="Breakdown" value={draft.breakdown} onChange={(breakdown) => setDraft((current) => current ? { ...current, breakdown } : current)} />}
          {editError && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/[0.07] px-3 py-2 text-sm text-red-200">{editError}</p>}
          <div className="flex justify-end gap-2 border-t border-white/10 pt-3"><button type="button" onClick={() => { setEditing(null); setDraft(null); }} className="rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-white/5">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-[#fca311] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </section>
    </div>}
  </LibraryFrame>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-300">{value}</p></div>;
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-medium text-gray-400">{label}<input required={label === 'Japanese sentence' || label === 'Word'} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/50" /></label>;
}

function LibraryFrame({ children }: { children: ReactNode }) {
  return <main className="min-h-[calc(100dvh-3.5rem)] bg-[#15171d] px-4 py-5 text-gray-100 sm:px-8 sm:py-7"><div className="mx-auto max-w-5xl">{children}</div></main>;
}

function SetupMessage() {
  return <section className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-[#1d2028] p-6"><h1 className="text-lg font-semibold text-white">Card library unavailable</h1><p className="mt-2 text-sm text-gray-400">Connect Supabase to browse your saved cards.</p></section>;
}
