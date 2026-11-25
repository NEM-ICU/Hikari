'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { KANJI_CURRICULUM, nextCurriculumLevel } from '@/lib/kanjiCurriculum';

type KanjiInfo = { kanji: string; meanings: string[]; on_readings: string[]; kun_readings: string[]; grade: number | null; jlpt: number | null; stroke_count: number };
type KanjiItem = KanjiInfo & { id: string; user_id: string; curriculum_level: number; srs_stage: number; due_at: string; components?: { character: string; meaning: string }[]; mnemonic?: string };
type WordItem = { id: string; word: string; reading: string; meanings: string[]; source_kanji: string | null; curriculum_level: number; srs_stage: number; due_at: string };
type Profile = { user_id: string; current_level: number; completed_at: string | null };
type Phase = 'overview' | 'kanji' | 'vocabulary';

const API = 'https://kanjiapi.dev/v1';
const KANJI_INTERVALS = [4, 8, 24, 48, 168, 336, 720, 2880];
const WORD_INTERVALS = [4, 8, 24, 72, 168, 336, 720, 2160];

function norm(text: string) { return text.trim().toLocaleLowerCase().replace(/[\s　・.-]/g, ''); }
type WordDisplayPart = { kanji?: string; kana: string };
const WORD_DISPLAY_PARTS: Record<string, WordDisplayPart[]> = {
  日本: [{ kanji: '日', kana: 'に' }, { kana: 'ほん' }],
  日曜日: [{ kanji: '日', kana: 'にち' }, { kana: 'よう' }, { kanji: '日', kana: 'び' }],
  毎日: [{ kana: 'まい' }, { kanji: '日', kana: 'にち' }],
  月曜日: [{ kanji: '月', kana: 'げつ' }, { kana: 'よう' }, { kanji: '日', kana: 'び' }],
  一月: [{ kana: 'いち' }, { kanji: '月', kana: 'がつ' }],
  火曜日: [{ kanji: '火', kana: 'か' }, { kana: 'よう' }, { kanji: '日', kana: 'び' }],
  火山: [{ kanji: '火', kana: 'か' }, { kana: 'ざん' }],
  水曜日: [{ kanji: '水', kana: 'すい' }, { kana: 'よう' }, { kanji: '日', kana: 'び' }],
  水道: [{ kanji: '水', kana: 'すい' }, { kana: 'どう' }],
  木曜日: [{ kanji: '木', kana: 'もく' }, { kana: 'よう' }, { kanji: '日', kana: 'び' }],
  '木の下': [{ kanji: '木', kana: 'き' }, { kana: 'の' }, { kana: 'した' }],
};
function displayWord(word: string, reading: string, revealedKanji: Set<string>, showReading = false) {
  const hasUnlearnedKanji = [...word].some((character) => /[\u3400-\u9fff]/u.test(character) && !revealedKanji.has(character));
  if (!hasUnlearnedKanji) return showReading ? <ruby>{word}<rt className="text-xs text-amber-300">{reading}</rt></ruby> : word;
  const parts = WORD_DISPLAY_PARTS[word];
  if (!parts) return reading;
  return <span>{parts.map((part, index) => {
    if (!part.kanji || !revealedKanji.has(part.kanji)) return <span key={`${part.kana}-${index}`}>{part.kana}</span>;
    return showReading
      ? <ruby key={`${part.kanji}-${index}`}>{part.kanji}<rt className="text-xs text-amber-300">{part.kana}</rt></ruby>
      : <span key={`${part.kanji}-${index}`}>{part.kanji}</span>;
  })}</span>;
}
function remaining(date: string) {
  const minutes = Math.max(1, Math.ceil((new Date(date).getTime() - Date.now()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.ceil(minutes / 60)} hr`;
  return `${Math.ceil(minutes / 1440)} days`;
}

export default function KanjiPathway({ client, user, onCustom }: { client: SupabaseClient; user: User; onCustom: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kanjiItems, setKanjiItems] = useState<KanjiItem[]>([]);
  const [words, setWords] = useState<WordItem[]>([]);
  const [phase, setPhase] = useState<Phase>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [lessonStep, setLessonStep] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [kanjiResult, setKanjiResult] = useState<{ item: KanjiItem; meaning: boolean; revealReading: boolean } | null>(null);
  const [wordAnswer, setWordAnswer] = useState('');
  const [wordResult, setWordResult] = useState<{ item: WordItem; meaning: boolean } | null>(null);
  const [showWordReading, setShowWordReading] = useState(false);

  const level = profile?.current_level ?? 5;
  const curriculum = KANJI_CURRICULUM[level];
  const levelKanji = kanjiItems.filter((item) => item.curriculum_level === level);
  const levelWords = words.filter((item) => item.curriculum_level === level);
  const revealedKanji = new Set(kanjiItems.filter((item) => item.srs_stage >= 0).map((item) => item.kanji));
  const kanjiLesson = levelKanji.find((item) => item.srs_stage === -1) ?? null;
  const dueKanji = kanjiItems.filter((item) => item.curriculum_level >= level && item.srs_stage >= 0 && item.srs_stage < 8 && new Date(item.due_at).getTime() <= now).sort((a, b) => a.due_at.localeCompare(b.due_at))[0] ?? null;
  const nextKanji = kanjiItems.filter((item) => item.curriculum_level >= level && item.srs_stage >= 0 && item.srs_stage < 8 && new Date(item.due_at).getTime() > now).sort((a, b) => a.due_at.localeCompare(b.due_at))[0] ?? null;
  const wordDue = words.filter((item) => item.curriculum_level >= level && item.srs_stage < 8 && new Date(item.due_at).getTime() <= now).sort((a, b) => a.due_at.localeCompare(b.due_at))[0] ?? null;
  const nextWord = words.filter((item) => item.curriculum_level >= level && item.srs_stage < 8 && new Date(item.due_at).getTime() > now).sort((a, b) => a.due_at.localeCompare(b.due_at))[0] ?? null;
  const currentKanji = kanjiLesson ?? dueKanji;

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setLoading(true); setError('');
      const { data: existing, error: readError } = await client.from('kanji_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (readError) { if (active) { setError(readError.message); setLoading(false); } return; }
      let profileData = existing as Profile | null;
      if (!profileData) {
        const { data, error: insertError } = await client.from('kanji_profiles').insert({ user_id: user.id, current_level: 5 }).select('*').single();
        if (insertError) { if (active) { setError(insertError.message); setLoading(false); } return; }
        profileData = data as Profile;
      }
      if (active) setProfile(profileData);
    };
    void loadProfile();
    return () => { active = false; };
  }, [client, user.id]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    const initializeLevel = async () => {
      setLoading(true); setError('');
      try {
        const current = KANJI_CURRICULUM[profile.current_level];
        const { data: existingKanji, error: existingError } = await client.from('kanji_study_items').select('kanji').eq('user_id', user.id).in('kanji', current.kanji);
        if (existingError) throw existingError;
        const have = new Set((existingKanji ?? []).map((row: { kanji: string }) => row.kanji));
        const missing = current.kanji.filter((character) => !have.has(character));
        if (missing.length) {
          const details = await Promise.all(missing.map(async (character) => {
            const response = await fetch(`${API}/kanji/${encodeURIComponent(character)}`);
            if (!response.ok) throw new Error(`Kanji data is unavailable for ${character}.`);
            return response.json() as Promise<KanjiInfo>;
          }));
          const { error: addError } = await client.from('kanji_study_items').insert(details.map((detail) => ({
            user_id: user.id, curriculum_level: profile.current_level, kanji: detail.kanji,
            meanings: detail.meanings, on_readings: detail.on_readings, kun_readings: detail.kun_readings,
            grade: detail.grade, jlpt: detail.jlpt, stroke_count: detail.stroke_count,
            srs_stage: -1, due_at: new Date().toISOString(),
          })));
          if (addError) throw addError;
        }
        const { error: tagError } = await client.from('kanji_study_items').update({ curriculum_level: profile.current_level }).eq('user_id', user.id).in('kanji', current.kanji);
        if (tagError) throw tagError;

        const deckName = `JLPT N${profile.current_level} · Guided`;
        let { data: deck, error: deckReadError } = await client.from('kanji_decks').select('id').eq('user_id', user.id).eq('name', deckName).maybeSingle();
        if (deckReadError) throw deckReadError;
        if (!deck) {
          const created = await client.from('kanji_decks').insert({ user_id: user.id, name: deckName }).select('id').single();
          if (created.error) throw created.error;
          deck = created.data;
        }
        const deckId = (deck as { id: string }).id;
        const { data: existingWords, error: wordReadError } = await client.from('kanji_vocab_items').select('word,reading').eq('deck_id', deckId);
        if (wordReadError) throw wordReadError;
        const known = new Set((existingWords ?? []).map((word: { word: string; reading: string }) => `${word.word}|${word.reading}`));
        const missingWords = current.words.filter((word) => !known.has(`${word.word}|${word.reading}`));
        if (missingWords.length) {
          const { error: wordInsertError } = await client.from('kanji_vocab_items').insert(missingWords.map((word) => ({
            user_id: user.id, deck_id: deckId, curriculum_level: profile.current_level,
            word: word.word, reading: word.reading, meanings: [word.meaning], source_kanji: word.kanji,
            srs_stage: 0, due_at: new Date().toISOString(),
          })));
          if (wordInsertError) throw wordInsertError;
        }
        const [kanjiQuery, wordsQuery] = await Promise.all([
          client.from('kanji_study_items').select('*').eq('user_id', user.id).gte('curriculum_level', profile.current_level).order('created_at'),
          client.from('kanji_vocab_items').select('*').eq('user_id', user.id).gte('curriculum_level', profile.current_level).order('created_at'),
        ]);
        if (kanjiQuery.error) throw kanjiQuery.error;
        if (wordsQuery.error) throw wordsQuery.error;
        if (active) { setKanjiItems((kanjiQuery.data ?? []) as KanjiItem[]); setWords((wordsQuery.data ?? []) as WordItem[]); setPhase('overview'); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not prepare this level.');
      } finally { if (active) setLoading(false); }
    };
    void initializeLevel();
    return () => { active = false; };
  }, [client, profile?.current_level, user.id]);

  useEffect(() => {
    if (!nextKanji && !nextWord) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [nextKanji?.due_at, nextWord?.due_at]);

  useEffect(() => {
    setLessonStep(0); setAnswer(''); setFeedback(''); setKanjiResult(null);
    setWordAnswer(''); setWordResult(null); setShowWordReading(false);
  }, [profile?.current_level]);

  const setStartingLevel = async (nextLevel: number) => {
    if (!profile || saving) return;
    setSaving(true); setError('');
    const { data, error: updateError } = await client.from('kanji_profiles').update({ current_level: nextLevel, completed_at: null, updated_at: new Date().toISOString() }).eq('user_id', user.id).select('*').single();
    if (updateError) setError(updateError.message);
    else { setProfile(data as Profile); setPhase('overview'); }
    setSaving(false);
  };

  const completeKanjiLesson = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentKanji || !kanjiLesson || !answer.trim()) return;
    const valid = currentKanji.meanings.some((meaning) => norm(meaning) === norm(answer));
    if (!valid) { setFeedback('Not quite. Try to recall the core meaning.'); return; }
    setSaving(true); setError('');
    const dueAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const { error: updateError } = await client.from('kanji_study_items').update({ srs_stage: 0, due_at: dueAt, lesson_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', currentKanji.id);
    if (updateError) setError(updateError.message);
    else {
      setKanjiItems((old) => old.map((item) => item.id === currentKanji.id ? { ...item, srs_stage: 0, due_at: dueAt } : item));
      setLessonStep(0); setAnswer(''); setFeedback('');
    }
    setSaving(false);
  };

  const submitKanjiReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!dueKanji || !answer.trim() || saving) return;
    const meaningCorrect = dueKanji.meanings.some((meaning) => norm(meaning) === norm(answer));
    const stage = meaningCorrect ? Math.min(8, dueKanji.srs_stage + 1) : Math.max(0, dueKanji.srs_stage - (dueKanji.srs_stage >= 4 ? 2 : 1));
    const hours = meaningCorrect ? (stage >= 8 ? 0 : KANJI_INTERVALS[stage]) : 10 / 60;
    const dueAt = new Date(Date.now() + hours * 3_600_000).toISOString();
    setSaving(true); setError('');
    const { error: rpcError } = await client.rpc('record_kanji_meaning_review', {
      p_item_id: dueKanji.id, p_meaning_answer: answer, p_meaning_correct: meaningCorrect,
      p_stage_before: dueKanji.srs_stage, p_stage_after: stage, p_due_at: dueAt,
    });
    if (rpcError) setError(rpcError.message);
    else {
      const reviewed = { ...dueKanji, srs_stage: stage, due_at: dueAt };
      setKanjiItems((old) => old.map((item) => item.id === reviewed.id ? reviewed : item));
      setKanjiResult({ item: reviewed, meaning: meaningCorrect, revealReading: false });
      setAnswer(''); setFeedback('');
    }
    setSaving(false);
  };

  const submitWordReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!wordDue || !wordAnswer.trim() || saving) return;
    const meaningCorrect = wordDue.meanings.some((meaning) => norm(meaning) === norm(wordAnswer));
    const stage = meaningCorrect ? Math.min(8, wordDue.srs_stage + 1) : Math.max(0, wordDue.srs_stage - (wordDue.srs_stage >= 4 ? 2 : 1));
    const hours = meaningCorrect ? (stage >= 8 ? 0 : WORD_INTERVALS[stage]) : 10 / 60;
    const dueAt = new Date(Date.now() + hours * 3_600_000).toISOString();
    setSaving(true); setError('');
    const { error: updateError } = await client.from('kanji_vocab_items').update({ srs_stage: stage, due_at: dueAt }).eq('id', wordDue.id).eq('user_id', user.id);
    if (updateError) setError(updateError.message);
    else {
      const reviewed = { ...wordDue, srs_stage: stage, due_at: dueAt };
      const updatedWords = words.map((word) => word.id === reviewed.id ? reviewed : word);
      setWords(updatedWords); setWordResult({ item: reviewed, meaning: meaningCorrect });
      setWordAnswer(''); setShowWordReading(false);
      if (meaningCorrect && curriculum.words.every((target) => updatedWords.some((word) => word.word === target.word && word.srs_stage >= 1))) {
        const nextLevel = nextCurriculumLevel(level);
        const { data, error: profileError } = await client.from('kanji_profiles').update({
          current_level: nextLevel ?? level,
          completed_at: nextLevel === null ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id).select('*').single();
        if (profileError) setError(profileError.message);
        else setProfile(data as Profile);
      }
    }
    setSaving(false);
  };

  if (loading) return <section className="rounded-2xl border border-white/10 bg-[#1d2028] p-12 text-center text-sm text-gray-400">Preparing your JLPT level…</section>;
  if (!profile) return <section className="rounded-2xl border border-white/10 bg-[#1d2028] p-8 text-center text-sm text-gray-400">Could not load your study profile.</section>;

  const stageLabel = ['Apprentice 1', 'Apprentice 2', 'Apprentice 3', 'Apprentice 4', 'Guru 1', 'Guru 2', 'Master', 'Enlightened', 'Burned'];
  const getChoices = (item: KanjiItem, type: 'meaning' | 'reading') => {
    const correct = type === 'meaning'
      ? item.meanings
      : [...item.on_readings, ...item.kun_readings];
    const distractors = kanjiItems
      .filter((other) => other.id !== item.id)
      .flatMap((other) => type === 'meaning'
        ? other.meanings
        : [...other.on_readings, ...other.kun_readings]);
    const choices = [...new Map([...correct, ...distractors]
      .filter(Boolean)
      .map((choice) => [norm(choice), choice])).values()];
    return choices.sort((a, b) => {
      const aCorrect = correct.some((value) => norm(value) === norm(a));
      const bCorrect = correct.some((value) => norm(value) === norm(b));
      return Number(bCorrect) - Number(aCorrect) || a.localeCompare(b);
    }).slice(0, 4);
  };
  const getWordChoices = (item: WordItem, type: 'meaning' | 'reading') => {
    const correct = type === 'meaning' ? item.meanings : [item.reading];
    const distractors = words
      .filter((other) => other.id !== item.id)
      .flatMap((other) => type === 'meaning' ? other.meanings : [other.reading]);
    const choices = [...new Map([...correct, ...distractors]
      .filter(Boolean)
      .map((choice) => [norm(choice), choice])).values()];
    return choices.sort((a, b) => {
      const aCorrect = correct.some((value) => norm(value) === norm(a));
      const bCorrect = correct.some((value) => norm(value) === norm(b));
      return Number(bCorrect) - Number(aCorrect) || a.localeCompare(b);
    }).slice(0, 4);
  };
  const allKanjiLearned = curriculum.kanji.every((character) => levelKanji.some((item) => item.kanji === character && item.srs_stage >= 0));

  return <div className="space-y-5">
    <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white/10 bg-[#1d2028] p-6 sm:p-8"><div><p className="text-xs font-semibold tracking-[0.17em] text-amber-300">GUIDED JLPT PATH · PROFILE LEVEL N{level}</p><h1 className="mt-2 text-3xl font-semibold text-white">{curriculum.label}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">A fixed set of five kanji, followed by fifteen useful words that use them. Finish this level’s kanji lessons to unlock its vocabulary. Your profile advances automatically after the word set.</p></div><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => void client.auth.signOut()} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:text-white">Sign out</button><button type="button" onClick={onCustom} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:text-white">Custom study</button></div></section>

    {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200">{error}</p>}

    {profile.completed_at ? <section className="rounded-2xl border border-emerald-300/15 bg-[#1d2028] p-8 text-center"><p className="text-5xl text-emerald-200">✓</p><h2 className="mt-4 text-2xl font-semibold text-white">Guided path complete</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-400">You’ve finished the five level sets and their jukugo. Keep reviewing from Custom Study or revisit the N5 set.</p><button type="button" onClick={() => void setStartingLevel(5)} className="mt-5 rounded-lg bg-[#fca311] px-4 py-2.5 text-sm font-semibold text-black">Return to N5</button></section> : <>
      <nav className="flex flex-wrap gap-2"><button type="button" onClick={() => setPhase('overview')} className={`rounded-lg px-4 py-2 text-sm ${phase === 'overview' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>Level overview</button><button type="button" onClick={() => setPhase('kanji')} className={`rounded-lg px-4 py-2 text-sm ${phase === 'kanji' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>Kanji · {levelKanji.filter((item) => item.srs_stage >= 0).length}/5</button><button type="button" onClick={() => setPhase('vocabulary')} disabled={!allKanjiLearned} className={`rounded-lg px-4 py-2 text-sm disabled:opacity-40 ${phase === 'vocabulary' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>Jukugo · {levelWords.filter((item) => item.srs_stage >= 1).length}/{curriculum.words.length}</button></nav>

      {phase === 'overview' && <section className="grid gap-4 md:grid-cols-2"><button type="button" onClick={() => setPhase('kanji')} className="rounded-2xl border border-sky-300/15 bg-[#1d2028] p-6 text-left hover:border-sky-300/30"><p className="text-xs font-semibold tracking-wider text-sky-200">STEP 1 · KANJI</p><h2 className="mt-2 text-xl font-semibold text-white">Learn this level’s five characters</h2><div className="mt-4 flex gap-3 text-3xl text-white">{curriculum.kanji.map((character) => <span key={character}>{character}</span>)}</div><p className="mt-3 text-sm text-gray-400">{levelKanji.filter((item) => item.srs_stage >= 0).length} of 5 lessons completed</p><span className="mt-4 inline-block rounded-lg bg-sky-300/10 px-3 py-2 text-sm text-sky-100">{allKanjiLearned ? 'Review kanji' : 'Start kanji lessons'}</span></button><button type="button" disabled={!allKanjiLearned} onClick={() => setPhase('vocabulary')} className="rounded-2xl border border-amber-300/15 bg-[#1d2028] p-6 text-left hover:border-amber-300/30 disabled:cursor-not-allowed disabled:opacity-50"><p className="text-xs font-semibold tracking-wider text-amber-200">STEP 2 · LEVEL WORDS</p><h2 className="mt-2 text-xl font-semibold text-white">Use them in jukugo</h2><div className="mt-4 flex gap-3 text-2xl text-white">{curriculum.words.slice(0, 5).map((word) => <span key={word.word}>{displayWord(word.word, word.reading, revealedKanji)}</span>)}</div><p className="mt-3 text-sm text-gray-400">{allKanjiLearned ? `${levelWords.filter((item) => item.srs_stage >= 1).length} of ${curriculum.words.length} words completed` : 'Unlock after all five kanji lessons'}</p><span className="mt-4 inline-block rounded-lg bg-amber-300/10 px-3 py-2 text-sm text-amber-100">{allKanjiLearned ? 'Start level vocabulary' : 'Locked until kanji are learned'}</span></button></section>}

      {phase === 'kanji' && <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]"><div className="rounded-2xl border border-white/10 bg-[#1d2028] p-6 text-center sm:p-8">{kanjiLesson ? <div className="mx-auto max-w-xl"><p className="text-xs font-semibold tracking-wider text-sky-200">KANJI LESSON · {levelKanji.filter((item) => item.srs_stage === -1).length} LEFT</p><p className="py-6 text-8xl text-white">{kanjiLesson.kanji}</p>{lessonStep === 0 ? <><p className="text-xl text-amber-200">{kanjiLesson.meanings.join(' · ')}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[#15171d] p-4"><p className="text-[10px] text-gray-500">ON’YOMI</p><p className="mt-2 text-sm text-white">{kanjiLesson.on_readings.join('、') || '—'}</p></div><div className="rounded-xl bg-[#15171d] p-4"><p className="text-[10px] text-gray-500">KUN’YOMI</p><p className="mt-2 text-sm text-white">{kanjiLesson.kun_readings.join('、') || '—'}</p></div></div>{kanjiLesson.components?.length ? <p className="mt-4 text-sm text-gray-300">{kanjiLesson.components.map((part) => `${part.character} ${part.meaning}`).join(' · ')}</p> : null}{kanjiLesson.mnemonic && <p className="mt-3 text-sm leading-6 text-gray-400">{kanjiLesson.mnemonic}</p>}<button type="button" onClick={() => setLessonStep(1)} className="mt-6 w-full rounded-xl bg-[#fca311] px-5 py-3 text-sm font-semibold text-black">Practice meaning</button></> : <form onSubmit={(event) => void completeKanjiLesson(event)} className="mx-auto max-w-md"><p className="text-xs font-semibold tracking-wider text-amber-200">MEANING · CHECK 1 OF 1</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{getChoices(currentKanji, 'meaning').map((choice) => <button key={choice} type="button" onClick={() => { setAnswer(choice); setFeedback(''); }} className={`rounded-xl border px-4 py-3 text-left text-sm transition ${norm(answer) === norm(choice) ? 'border-amber-300 bg-amber-300/10 text-amber-100' : 'border-white/10 bg-[#15171d] text-gray-200 hover:border-white/20'}`}>{choice}</button>)}</div><button disabled={saving || !answer.trim()} className="mt-3 w-full rounded-xl bg-[#fca311] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">Check answer</button>{feedback && <p className="mt-3 text-sm text-amber-200">{feedback}</p>}<button type="button" onClick={() => { setLessonStep(0); setAnswer(''); setFeedback(''); }} className="mt-4 text-xs text-gray-500">Review kanji</button></form>}</div> : dueKanji || kanjiResult ? <div className="rounded-2xl border border-white/10 bg-[#1d2028] p-6 text-center sm:p-8"><p className="text-xs font-semibold tracking-wider text-amber-200">KANJI REVIEW · {dueKanji ? stageLabel[dueKanji.srs_stage] : 'COMPLETE'}</p><p className="py-6 text-8xl text-white">{(kanjiResult?.item ?? dueKanji)?.kanji}</p>{kanjiResult ? <><p className={kanjiResult.meaning ? 'text-emerald-200' : 'text-rose-200'}>Meaning {kanjiResult.meaning ? '✓' : '✕'} · {kanjiResult.item.meanings.join(' / ')}</p>{!kanjiResult.meaning && !kanjiResult.revealReading && <button type="button" onClick={() => setKanjiResult((result) => result ? { ...result, revealReading: true } : result)} className="mt-4 rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-200">Reveal reading</button>}{kanjiResult.revealReading && <p className="mt-3 text-sm text-gray-300">Reading · {[...kanjiResult.item.on_readings, ...kanjiResult.item.kun_readings].join(' / ') || 'No reading listed'}</p>}<button type="button" onClick={() => setKanjiResult(null)} className="mt-5 rounded-lg bg-white/10 px-4 py-2 text-sm text-white">Next review</button></> : <form onSubmit={(event) => void submitKanjiReview(event)} className="mx-auto max-w-md"><p className="text-xs font-semibold tracking-wider text-amber-200">MEANING · CHECK 1 OF 1</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{getChoices(dueKanji, 'meaning').map((choice) => <button key={choice} type="button" onClick={() => { setAnswer(choice); setFeedback(''); }} className={`rounded-xl border px-4 py-3 text-left text-sm transition ${norm(answer) === norm(choice) ? 'border-amber-300 bg-amber-300/10 text-amber-100' : 'border-white/10 bg-[#15171d] text-gray-200 hover:border-white/20'}`}>{choice}</button>)}</div><button disabled={saving || !answer.trim()} className="mt-3 w-full rounded-xl bg-[#fca311] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">Check answer</button>{feedback && <p className="mt-3 text-sm text-amber-200">{feedback}</p>}</form>}</div> : <div className="rounded-2xl border border-white/10 bg-[#1d2028] p-8 text-center"><p className="text-4xl text-emerald-200">✓</p><h2 className="mt-3 text-xl text-white">Kanji lessons complete</h2><p className="mt-2 text-sm text-gray-400">{nextKanji ? `Next review in ${remaining(nextKanji.due_at)}.` : 'Your level vocabulary is now unlocked.'}</p><button type="button" onClick={() => setPhase(allKanjiLearned ? 'vocabulary' : 'overview')} className="mt-5 rounded-lg bg-[#fca311] px-4 py-2.5 text-sm font-semibold text-black">{allKanjiLearned ? 'Continue to jukugo' : 'Level overview'}</button></div>}</div><div className="rounded-2xl border border-white/10 bg-[#1d2028] p-5"><p className="text-xs font-semibold tracking-wider text-gray-500">LEVEL SET</p><div className="mt-3 space-y-2">{curriculum.kanji.map((character) => { const item = levelKanji.find((entry) => entry.kanji === character); return <div key={character} className="flex items-center justify-between rounded-lg bg-[#15171d] px-3 py-2"><span className="text-xl text-white">{character}</span><span className="text-xs text-gray-500">{item?.srs_stage === -1 ? 'Lesson' : item ? stageLabel[item.srs_stage] : 'Loading'}</span></div>; })}</div></div></section>}

      {phase === 'vocabulary' && <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]"><div className="rounded-2xl border border-white/10 bg-[#1d2028] p-6 text-center sm:p-8">{!allKanjiLearned ? <><h2 className="text-xl text-white">Finish the five kanji first</h2><p className="mt-2 text-sm text-gray-400">Level words unlock after each character has had its first lesson.</p><button type="button" onClick={() => setPhase('kanji')} className="mt-5 rounded-lg bg-[#fca311] px-4 py-2.5 text-sm font-semibold text-black">Go to kanji lessons</button></> : wordDue || wordResult ? <><p className="text-xs font-semibold tracking-wider text-fuchsia-200">N{wordResult?.item.curriculum_level ?? wordDue?.curriculum_level ?? level} JUKUGO · {levelWords.filter((word) => word.srs_stage < 1).length} TO LEARN IN THIS SET</p><p className="py-6 text-5xl text-white">{displayWord((wordResult?.item ?? wordDue)!.word, (wordResult?.item ?? wordDue)!.reading, revealedKanji, showWordReading)}</p><button type="button" onClick={() => setShowWordReading((shown) => !shown)} className="-mt-3 mb-4 rounded-lg border border-amber-300/30 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-300/10">{showWordReading ? 'Hide furigana' : 'Reveal reading'}</button>{wordResult ? <><p className={wordResult.meaning ? 'text-emerald-200' : 'text-rose-200'}>Meaning {wordResult.meaning ? '✓' : '✕'} · {wordResult.item.meanings.join(' / ')}</p><button type="button" onClick={() => { setWordResult(null); setShowWordReading(false); }} className="mt-5 rounded-lg bg-white/10 px-4 py-2 text-sm text-white">Next word</button></> : <form onSubmit={(event) => void submitWordReview(event)} className="mx-auto max-w-md"><p className="text-xs font-semibold tracking-wider text-fuchsia-200">MEANING · CHECK 1 OF 1</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{getWordChoices(wordDue, 'meaning').map((choice) => <button key={choice} type="button" onClick={() => setWordAnswer(choice)} className={`rounded-xl border px-4 py-3 text-left text-sm transition ${norm(wordAnswer) === norm(choice) ? 'border-amber-300 bg-amber-300/10 text-amber-100' : 'border-white/10 bg-[#15171d] text-gray-200 hover:border-white/20'}`}>{choice}</button>)}</div><button disabled={saving || !wordAnswer.trim()} className="mt-3 w-full rounded-xl bg-[#fca311] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">Check answer</button></form>}</> : <div><h2 className="text-xl text-white">Jukugo set complete</h2><p className="mt-2 text-sm text-gray-400">{nextWord ? `Next review in ${remaining(nextWord.due_at)}.` : 'You’re ready for the next level.'}</p></div>}</div><div className="rounded-2xl border border-white/10 bg-[#1d2028] p-5"><p className="text-xs font-semibold tracking-wider text-gray-500">THIS LEVEL’S WORDS</p><div className="mt-3 space-y-2">{curriculum.words.map((target) => { const item = levelWords.find((entry) => entry.word === target.word); return <div key={target.word} className="flex items-center justify-between rounded-lg bg-[#15171d] px-3 py-2"><div><p className="text-lg text-white">{displayWord(target.word, target.reading, revealedKanji)}</p><p className="text-xs text-gray-500">{target.meaning}</p></div><span className="text-[10px] text-gray-500">{item?.srs_stage >= 1 ? 'Learned' : 'To learn'}</span></div>; })}</div></div></section>}
    </>}
  </div>;
}
