'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';

type Deck = { id: string; name: string };
type VocabItem = { id: string; deck_id: string; word: string; reading: string; meanings: string[]; source_kanji: string | null; srs_stage: number; due_at: string };
type ApiWord = { meanings: { glosses: string[] }[]; variants: { written: string; pronounced: string; priorities: string[] }[] };

const API = 'https://kanjiapi.dev/v1';
const intervalsHours = [4, 8, 24, 72, 168, 336, 720, 2160];

export default function KanjiDecks({ client, user, kanji }: { client: SupabaseClient; user: User; kanji: string[] }) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [items, setItems] = useState<VocabItem[]>([]);
  const [deckId, setDeckId] = useState('');
  const [deckName, setDeckName] = useState('');
  const [source, setSource] = useState(kanji[0] ?? '');
  const [words, setWords] = useState<ApiWord[]>([]);
  const [loadingWords, setLoadingWords] = useState(false);
  const [reviewStep, setReviewStep] = useState(0);
  const [reviewAnswer, setReviewAnswer] = useState('');
  const [meaningCorrect, setMeaningCorrect] = useState<boolean | null>(null);
  const [vocabResult, setVocabResult] = useState<{ item: VocabItem; meaning: boolean; reading: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const loadDecks = async () => {
    const { data, error: queryError } = await client.from('kanji_decks').select('id,name').order('created_at');
    if (queryError) { setError(queryError.message); return; }
    const rows = (data ?? []) as Deck[];
    setDecks(rows);
    if (!deckId && rows[0]) setDeckId(rows[0].id);
  };

  useEffect(() => { void loadDecks(); }, [client]);

  useEffect(() => {
    let active = true;
    if (!deckId) { setItems([]); return; }
    void client.from('kanji_vocab_items').select('*').eq('deck_id', deckId).order('due_at').then(({ data, error: queryError }) => {
      if (!active) return;
      if (queryError) setError(queryError.message);
      else setItems((data ?? []) as VocabItem[]);
    });
    return () => { active = false; };
  }, [client, deckId]);

  useEffect(() => {
    let active = true;
    if (!source) return;
    setLoadingWords(true);
    setError('');
    fetch(`${API}/words/${encodeURIComponent(source)}`)
      .then((response) => { if (!response.ok) throw new Error('Could not load example words.'); return response.json() as Promise<ApiWord[]>; })
      .then((data) => { if (active) setWords(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load example words.'); })
      .finally(() => { if (active) setLoadingWords(false); });
    return () => { active = false; };
  }, [source]);

  const nextDue = useMemo(() => items.filter((item) => item.srs_stage < 8 && new Date(item.due_at).getTime() > now).sort((a, b) => a.due_at.localeCompare(b.due_at))[0], [items, now]);
  useEffect(() => {
    if (!nextDue) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [nextDue?.due_at]);
  const due = useMemo(() => items.filter((item) => new Date(item.due_at).getTime() <= now && item.srs_stage < 8), [items, now]);
  const existingWords = useMemo(() => new Set(items.map((item) => `${item.word}|${item.reading}`)), [items]);

  const createDeck = async (event: FormEvent) => {
    event.preventDefault();
    const name = deckName.trim();
    if (!name) return;
    setBusy(true); setError('');
    const { data, error: insertError } = await client.from('kanji_decks').insert({ user_id: user.id, name }).select('id,name').single();
    if (insertError) setError(insertError.message);
    else { const deck = data as Deck; setDecks((old) => [...old, deck]); setDeckId(deck.id); setDeckName(''); }
    setBusy(false);
  };

  const addWord = async (word: ApiWord) => {
    if (!deckId || busy) return;
    const variant = word.variants.find((v) => v.written.includes(source)) ?? word.variants[0];
    if (!variant) return;
    const payload = { user_id: user.id, deck_id: deckId, word: variant.written, reading: variant.pronounced, meanings: word.meanings.flatMap((m) => m.glosses).slice(0, 6), source_kanji: source };
    setBusy(true); setError('');
    const { error: insertError } = await client.from('kanji_vocab_items').upsert(payload, { onConflict: 'deck_id,word,reading', ignoreDuplicates: true });
    if (insertError) setError(insertError.message);
    else {
      const { data: savedItem, error: readError } = await client.from('kanji_vocab_items').select('*').eq('deck_id', deckId).eq('word', payload.word).eq('reading', payload.reading).single();
      if (readError) setError(readError.message);
      else setItems((old) => old.some((item) => item.id === savedItem.id) ? old : [...old, savedItem as VocabItem]);
    }
    setBusy(false);
  };

  const answerVocab = async (event: FormEvent) => {
    event.preventDefault();
    const item = due[0];
    if (!item || !reviewAnswer.trim() || busy) return;
    if (reviewStep === 0) {
      const correct = item.meanings.some((meaning) => meaning.toLocaleLowerCase().trim() === reviewAnswer.toLocaleLowerCase().trim());
      setMeaningCorrect(correct);
      setReviewStep(1);
      setReviewAnswer('');
      return;
    }
    const readingCorrect = item.reading.trim() === reviewAnswer.trim();
    const allCorrect = meaningCorrect === true && readingCorrect;
    const stage = allCorrect ? Math.min(8, item.srs_stage + 1) : Math.max(0, item.srs_stage - (item.srs_stage >= 4 ? 2 : 1));
    const hours = allCorrect ? (stage >= 8 ? 0 : intervalsHours[stage]) : 10 / 60;
    const dueAt = new Date(Date.now() + hours * 3_600_000).toISOString();
    setBusy(true); setError('');
    const { error: updateError } = await client.from('kanji_vocab_items').update({ srs_stage: stage, due_at: dueAt }).eq('id', item.id).eq('user_id', user.id);
    if (updateError) setError(updateError.message);
    else {
      const updated = { ...item, srs_stage: stage, due_at: dueAt };
      setItems((old) => old.map((entry) => entry.id === item.id ? updated : entry));
      setVocabResult({ item: updated, meaning: meaningCorrect === true, reading: readingCorrect });
      setReviewStep(0); setReviewAnswer(''); setMeaningCorrect(null);
    }
    setBusy(false);
  };

  const nextVocabReview = () => { setVocabResult(null); setReviewStep(0); setReviewAnswer(''); setMeaningCorrect(null); };

  if (!kanji.length) return <section className="mt-5 rounded-2xl border border-white/10 bg-[#1d2028] p-8 text-center"><p className="text-4xl text-amber-200">熟語</p><h2 className="mt-4 text-xl font-semibold text-white">Start with a kanji</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">Add a few characters to your kanji library first. Then choose one here to find jukugo, collect useful words, and build review decks.</p></section>;

  return <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <section className="rounded-2xl border border-white/10 bg-[#1d2028] p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Jukugo vocabulary</h2><p className="mt-1 text-sm text-gray-400">Collect words that use your kanji, then review them by deck.</p></div><label className="text-xs text-gray-500">Source kanji<select value={source} onChange={(e) => setSource(e.target.value)} className="ml-2 rounded-lg border border-white/10 bg-[#15171d] px-3 py-2 text-sm text-white">{kanji.map((character) => <option key={character}>{character}</option>)}</select></label></div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      <div className="mt-5 space-y-2">{loadingWords ? <p className="py-8 text-center text-sm text-gray-500">Finding words…</p> : words.filter((word) => word.variants.some((variant) => variant.written !== source && variant.written.includes(source))).slice(0, 30).map((word, index) => {
        const variant = word.variants.find((v) => v.written.includes(source)) ?? word.variants[0];
        if (!variant) return null;
        const meanings = word.meanings.flatMap((m) => m.glosses).slice(0, 3);
        const key = `${variant.written}|${variant.pronounced}`;
        const added = existingWords.has(key);
        return <div key={`${key}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#15171d] p-3"><div className="min-w-0 flex-1"><p className="text-xl text-white">{variant.written}<span className="ml-2 text-sm text-amber-200">{variant.pronounced}</span></p><p className="mt-1 truncate text-xs text-gray-500">{meanings.join(' · ')}</p></div><button type="button" disabled={!deckId || busy || added} onClick={() => void addWord(word)} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white disabled:opacity-40">{added ? 'Added' : 'Add to deck'}</button></div>;
      })}{!loadingWords && !words.some((word) => word.variants.some((variant) => variant.written !== source && variant.written.includes(source))) && <p className="py-8 text-center text-sm text-gray-500">No multi-character example words found for {source}.</p>}</div>
    </section>
    <aside className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-[#1d2028] p-5"><h3 className="font-semibold text-white">Your decks</h3><form onSubmit={(event) => void createDeck(event)} className="mt-3 flex gap-2"><input value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="e.g. N5 compounds" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#15171d] px-3 py-2 text-sm text-white"/><button disabled={busy || !deckName.trim()} className="rounded-lg bg-[#fca311] px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">Create</button></form><select value={deckId} onChange={(e) => { setDeckId(e.target.value); setVocabResult(null); setReviewStep(0); setReviewAnswer(''); }} className="mt-3 w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2 text-sm text-white">{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select><p className="mt-2 text-xs text-gray-500">{items.length} words · {due.length} due</p></section>
      <section className="rounded-2xl border border-white/10 bg-[#1d2028] p-5"><p className="text-xs font-semibold tracking-wider text-amber-200">WORD REVIEW · MEANING + READING</p>{vocabResult ? <div className="mt-4"><p className="text-center text-3xl text-white">{vocabResult.item.word}</p><div className="mt-4 space-y-2 text-sm"><p className={vocabResult.meaning ? 'text-emerald-200' : 'text-rose-200'}>Meaning {vocabResult.meaning ? '✓' : '✕'} · {vocabResult.item.meanings.join(' / ')}</p><p className={vocabResult.reading ? 'text-emerald-200' : 'text-rose-200'}>Reading {vocabResult.reading ? '✓' : '✕'} · {vocabResult.item.reading}</p></div><p className="mt-3 text-center text-xs text-gray-500">{vocabResult.meaning && vocabResult.reading ? vocabResult.item.srs_stage >= 8 ? 'Mastered · removed from reviews' : 'Both recalled · scheduled for a later review' : 'One missed · scheduled for a short retry'}</p><button type="button" onClick={nextVocabReview} className="mt-4 w-full rounded-lg bg-white/10 px-4 py-2 text-sm text-white">Next word</button></div> : due[0] ? <div className="mt-4 text-center"><p className="py-4 text-4xl text-white">{due[0].word}</p><p className="text-xs font-semibold tracking-wider text-gray-500">{reviewStep === 0 ? 'MEANING' : 'READING'}</p><form onSubmit={(event) => void answerVocab(event)} className="mt-3"><input autoFocus value={reviewAnswer} onChange={(e) => setReviewAnswer(e.target.value)} placeholder={reviewStep === 0 ? 'Type a meaning' : 'Type the reading in kana'} className="w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-3 text-sm text-white"/><button disabled={busy || !reviewAnswer.trim()} className="mt-2 w-full rounded-xl bg-[#fca311] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">{busy ? 'Saving…' : reviewStep === 0 ? 'Check meaning' : 'Check reading'}</button></form><p className="mt-3 text-xs text-gray-500">Word {reviewStep + 1} of 2 · both answers are required to advance its stage.</p></div> : <p className="mt-4 text-sm leading-6 text-gray-500">{items.length ? 'All words are scheduled. Add more jukugo or come back when reviews are due.' : 'Create a deck and add words from the list.'}</p>}</section>
    </aside>
  </div>;
}
