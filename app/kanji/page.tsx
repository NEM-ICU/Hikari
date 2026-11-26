'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import EmailMagicLink from '@/components/EmailMagicLink';
import KanjiDecks from '@/components/KanjiDecks';
import KanjiPathway from '@/components/KanjiPathway';
import { useSupabaseSession } from '@/lib/useSupabaseSession';

type KanjiInfo = {
  kanji: string;
  meanings: string[];
  on_readings: string[];
  kun_readings: string[];
  grade: number | null;
  jlpt: number | null;
  stroke_count: number;
};

type KanjiItem = KanjiInfo & {
  id: string;
  user_id: string;
  srs_stage: number;
  due_at: string;
  lesson_completed_at: string | null;
  created_at: string;
  components?: { character: string; meaning: string }[];
  mnemonic?: string;
  meaning_synonyms?: string[];
};

type View = 'dashboard' | 'lessons' | 'reviews' | 'browse' | 'vocabulary';
type PromptType = 'meaning' | 'reading';

const API = 'https://kanjiapi.dev/v1';
const STAGE_NAMES = ['Apprentice 1', 'Apprentice 2', 'Apprentice 3', 'Apprentice 4', 'Guru 1', 'Guru 2', 'Master', 'Enlightened', 'Burned'];
const STAGE_INTERVAL_HOURS = [4, 8, 24, 48, 168, 336, 720, 2880];
const FAST_STAGE_INTERVAL_HOURS = [2, 4, 8, 24, 48, 168, 336, 720];

function normalized(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[\s　・.-]/g, '');
}

function readableTime(date: Date, now = Date.now()) {
  const minutes = Math.max(1, Math.ceil((date.getTime() - now) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  return `${Math.ceil(hours / 24)} days`;
}

function stageName(stage: number) {
  return stage < 0 ? 'Lesson' : STAGE_NAMES[Math.min(stage, STAGE_NAMES.length - 1)];
}

export default function KanjiPage() {
  const { client, session, loading: authLoading } = useSupabaseSession();
  const [items, setItems] = useState<KanjiItem[]>([]);
  const [view, setView] = useState<View>('dashboard');
  const [mode, setMode] = useState<'guided' | 'custom'>('guided');
  const [level, setLevel] = useState('5');
  const [catalog, setCatalog] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [selectedKanji, setSelectedKanji] = useState<KanjiInfo | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [clockNow, setClockNow] = useState(Date.now());
  const [answer, setAnswer] = useState('');
  const [answered, setAnswered] = useState<{ meaning: boolean; reading: boolean } | null>(null);
  const [reviewedItem, setReviewedItem] = useState<KanjiItem | null>(null);
  const [reviewStep, setReviewStep] = useState(0);
  const [meaningAnswer, setMeaningAnswer] = useState('');
  const [meaningCorrect, setMeaningCorrect] = useState<boolean | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [lessonStep, setLessonStep] = useState(0);
  const [lessonFeedback, setLessonFeedback] = useState('');
  const [selectedForLessons, setSelectedForLessons] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [partsInput, setPartsInput] = useState('');
  const [mnemonic, setMnemonic] = useState('');

  const loadItems = useCallback(async () => {
    if (!client || !session) return;
    setLoadingItems(true);
    const { data, error: loadError } = await client
      .from('kanji_study_items')
      .select('*')
      .order('due_at', { ascending: true });
    if (loadError) setError(loadError.message);
    else setItems((data ?? []) as KanjiItem[]);
    setLoadingItems(false);
  }, [client, session]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  useEffect(() => {
    let active = true;
    if (mode === 'guided') {
      setLoadingCatalog(false);
      return () => { active = false; };
    }
    setLoadingCatalog(true);
    setCatalog([]);
    setSelectedKanji(null);
    fetch(`${API}/kanji/jlpt-${level}`)
      .then((response) => {
        if (!response.ok) throw new Error('Kanji catalog is unavailable. Please try again.');
        return response.json() as Promise<string[]>;
      })
      .then((data) => { if (active) setCatalog(data); })
      .catch((catalogError: unknown) => {
        if (active) setError(catalogError instanceof Error ? catalogError.message : 'Could not load the kanji catalog.');
      })
      .finally(() => { if (active) setLoadingCatalog(false); });
    return () => { active = false; };
  }, [level, mode]);

  const lessonItems = useMemo(
    () => items.filter((item) => item.srs_stage === -1).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [items]
  );
  const dueItems = useMemo(
    () => items.filter((item) => item.srs_stage >= 0 && item.srs_stage < 8 && new Date(item.due_at).getTime() <= clockNow),
    [items, clockNow]
  );
  const nextDue = useMemo(
    () => items.filter((item) => item.srs_stage >= 0 && item.srs_stage < 8 && new Date(item.due_at).getTime() > clockNow)
      .sort((a, b) => a.due_at.localeCompare(b.due_at))[0] ?? null,
    [items, clockNow]
  );

  useEffect(() => {
    if (!nextDue) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [nextDue?.due_at]);

  const currentLesson = lessonItems[0] ?? null;
  const currentReview = dueItems[0] ?? null;
  const promptType: PromptType = reviewStep === 0 ? 'meaning' : 'reading';
  const savedKanji = useMemo(() => new Set(items.map((item) => item.kanji)), [items]);
  const filteredCatalog = useMemo(() => {
    const normalizedQuery = query.trim();
    return catalog.filter((character) => !normalizedQuery || character.includes(normalizedQuery));
  }, [catalog, query]);

  const openKanji = async (character: string) => {
    setError('');
    const saved = items.find((item) => item.kanji === character);
    setPartsInput((saved?.components ?? []).map((part) => `${part.character} — ${part.meaning}`).join('\n'));
    setMnemonic(saved?.mnemonic ?? '');
    try {
      const response = await fetch(`${API}/kanji/${encodeURIComponent(character)}`);
      if (!response.ok) throw new Error('Could not load this kanji.');
      setSelectedKanji(await response.json() as KanjiInfo);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this kanji.');
    }
  };

  const addToLessons = async () => {
    if (!client || !session || !selectedKanji || saving) return;
    setSaving(true);
    setError('');
    const { error: saveError } = await client.from('kanji_study_items').upsert({
      user_id: session.user.id,
      kanji: selectedKanji.kanji,
      meanings: selectedKanji.meanings,
      on_readings: selectedKanji.on_readings,
      kun_readings: selectedKanji.kun_readings,
      grade: selectedKanji.grade,
      jlpt: selectedKanji.jlpt,
      stroke_count: selectedKanji.stroke_count,
      components: partsInput.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const [character, ...meaning] = line.split(/[—-]/);
        return { character: character.trim(), meaning: meaning.join('—').trim() };
      }),
      mnemonic,
      srs_stage: -1,
      due_at: new Date().toISOString(),
    }, { onConflict: 'user_id,kanji', ignoreDuplicates: true });
    if (saveError) setError(saveError.message);
    else {
      await loadItems();
      setSelectedKanji(null);
      setView('lessons');
    }
    setSaving(false);
  };

  const addSelectedLessons = async () => {
    if (!client || !session || !selectedForLessons.size || bulkSaving) return;
    setBulkSaving(true); setError('');
    const characters = [...selectedForLessons].filter((character) => !savedKanji.has(character));
    try {
      const details: KanjiInfo[] = [];
      for (let index = 0; index < characters.length; index += 12) {
        const batch = characters.slice(index, index + 12);
        const fetched = await Promise.all(batch.map(async (character) => {
          const response = await fetch(`${API}/kanji/${encodeURIComponent(character)}`);
          if (!response.ok) throw new Error(`Could not load ${character}.`);
          return response.json() as Promise<KanjiInfo>;
        }));
        details.push(...fetched);
      }
      if (details.length) {
        const { error: saveError } = await client.from('kanji_study_items').upsert(details.map((detail) => ({
          user_id: session.user.id, kanji: detail.kanji, meanings: detail.meanings,
          on_readings: detail.on_readings, kun_readings: detail.kun_readings,
          grade: detail.grade, jlpt: detail.jlpt, stroke_count: detail.stroke_count,
          srs_stage: -1, due_at: new Date().toISOString(),
        })), { onConflict: 'user_id,kanji', ignoreDuplicates: true });
        if (saveError) throw saveError;
      }
      setSelectedForLessons(new Set());
      await loadItems();
      setView('lessons');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add these kanji to lessons.');
    } finally { setBulkSaving(false); }
  };

  const saveComponents = async () => {
    if (!client || !session || !selectedKanji) return;
    const saved = items.find((item) => item.kanji === selectedKanji.kanji);
    if (!saved) { await addToLessons(); return; }
    setSaving(true);
    setError('');
    const components = partsInput.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [character, ...meaning] = line.split(/[—-]/);
      return { character: character.trim(), meaning: meaning.join('—').trim() };
    });
    const { error: updateError } = await client.from('kanji_study_items').update({ components, mnemonic }).eq('id', saved.id);
    if (updateError) setError(updateError.message);
    else setItems((old) => old.map((item) => item.id === saved.id ? { ...item, components, mnemonic } : item));
    setSaving(false);
  };

  const completeLesson = async (item: KanjiItem) => {
    if (!client) return;
    const hours = item.grade && item.grade <= 2 ? FAST_STAGE_INTERVAL_HOURS[0] : STAGE_INTERVAL_HOURS[0];
    const dueAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const { error: updateError } = await client.from('kanji_study_items').update({
      srs_stage: 0,
      due_at: dueAt,
      lesson_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', item.id);
    if (updateError) setError(updateError.message);
    else {
      setItems((existing) => existing.map((entry) => entry.id === item.id
        ? { ...entry, srs_stage: 0, due_at: dueAt, lesson_completed_at: new Date().toISOString() }
        : entry));
    }
  };

  const submitReview = async () => {
    if (!client || !currentReview || !answer.trim() || answered !== null) return;
    const accepted = promptType === 'meaning'
      ? [...currentReview.meanings, ...(currentReview.meaning_synonyms ?? [])].some((meaning) => normalized(meaning) === normalized(answer))
      : [...currentReview.on_readings, ...currentReview.kun_readings].some((reading) => normalized(reading) === normalized(answer));
    if (promptType === 'meaning') {
      setMeaningAnswer(answer);
      setMeaningCorrect(accepted);
      setReviewStep(1);
      setAnswer('');
      setReviewFeedback(`${accepted ? 'Meaning recalled.' : 'Meaning missed.'} Now recall one reading.`);
      return;
    }
    const meaningWasCorrect = meaningCorrect ?? [...currentReview.meanings, ...(currentReview.meaning_synonyms ?? [])]
      .some((meaning) => normalized(meaning) === normalized(meaningAnswer));
    const readingCorrect = accepted;
    const stageBefore = currentReview.srs_stage;
    const allCorrect = meaningWasCorrect && readingCorrect;
    const stageAfter = allCorrect ? Math.min(8, stageBefore + 1) : Math.max(0, stageBefore - (stageBefore >= 4 ? 2 : 1));
    const intervalList = currentReview.grade && currentReview.grade <= 2 ? FAST_STAGE_INTERVAL_HOURS : STAGE_INTERVAL_HOURS;
    const waitHours = allCorrect
      ? (stageAfter >= 8 ? 0 : intervalList[stageAfter])
      : 10 / 60;
    const dueAt = new Date(Date.now() + waitHours * 60 * 60 * 1000).toISOString();
    setIsLoading(true);
    setError('');
    const { error: reviewError } = await client.rpc('record_kanji_review_session', {
      p_item_id: currentReview.id,
      p_meaning_answer: meaningAnswer,
      p_meaning_correct: meaningWasCorrect,
      p_reading_answer: answer,
      p_reading_correct: readingCorrect,
      p_stage_before: stageBefore,
      p_stage_after: stageAfter,
      p_due_at: dueAt,
    });
    setIsLoading(false);
    if (reviewError) {
      setError(reviewError.message);
      return;
    }
    setAnswered({ meaning: meaningWasCorrect, reading: readingCorrect });
    setReviewedItem({ ...currentReview, srs_stage: stageAfter, due_at: dueAt });
    setReviewFeedback('');
    setItems((existing) => existing.map((item) => item.id === currentReview.id
      ? { ...item, srs_stage: stageAfter, due_at: dueAt }
      : item));
  };

  const continueReview = () => {
    setAnswered(null);
    setReviewedItem(null);
    setAnswer('');
    setMeaningAnswer('');
    setMeaningCorrect(null);
    setReviewStep(0);
    setReviewFeedback('');
  };

  useEffect(() => {
    setLessonStep(0);
    setAnswer('');
    setLessonFeedback('');
  }, [currentLesson?.id]);

  const answerLesson = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentLesson) return;
    if (lessonStep === 1) {
      const correct = [...currentLesson.meanings, ...(currentLesson.meaning_synonyms ?? [])].some((meaning) => normalized(meaning) === normalized(answer));
      if (!correct) { setLessonFeedback('Not quite. Think through the components and try again.'); return; }
      setLessonStep(2); setAnswer(''); setLessonFeedback('Correct. Now recall a reading.');
      return;
    }
    const readings = [...currentLesson.on_readings, ...currentLesson.kun_readings];
    const correct = readings.some((reading) => normalized(reading) === normalized(answer));
    if (!correct) { setLessonFeedback('Not quite. Review the reading and try again.'); return; }
    setLessonFeedback('Both meaning and reading recalled.');
    await completeLesson(currentLesson);
  };

  const shownReview = answered && reviewedItem ? reviewedItem : currentReview;

  if (!client) return <KanjiFrame><AuthNotice /></KanjiFrame>;
  if (authLoading) return <KanjiFrame><p className="py-24 text-center text-sm text-gray-400">Checking your library…</p></KanjiFrame>;
  if (!session) return <KanjiFrame><section className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#1d2028] p-6 text-center"><div className="text-3xl text-amber-300">漢</div><h1 className="mt-4 text-2xl font-semibold text-white">Kanji Corner</h1><p className="mt-2 text-sm leading-6 text-gray-400">Sign in to save your kanji lessons and review progress.</p><div className="mt-6"><EmailMagicLink client={client} /></div></section></KanjiFrame>;
  if (mode === 'guided') return <KanjiFrame><KanjiPathway client={client} user={session.user} onCustom={() => setMode('custom')} /></KanjiFrame>;

  const masteredCount = items.filter((item) => item.srs_stage >= 4).length;
  const stageGroups = [
    { title: 'Apprentice', stages: [0, 1, 2, 3], color: 'bg-rose-400' },
    { title: 'Guru', stages: [4, 5], color: 'bg-fuchsia-400' },
    { title: 'Master', stages: [6], color: 'bg-indigo-400' },
    { title: 'Enlightened', stages: [7], color: 'bg-sky-400' },
    { title: 'Burned', stages: [8], color: 'bg-amber-300' },
  ];

  return (
    <KanjiFrame>
      <header className="max-w-3xl">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-amber-300">KANJI CORNER · 漢字コーナー</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">A path from character to word.</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-6 text-gray-400">Learn its pieces, recall its meaning and reading, then meet it again inside real vocabulary.</p>
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="LESSONS" value={lessonItems.length} note="Ready to learn" />
        <Stat label="REVIEWS DUE" value={dueItems.length} note="Available now" />
        <Stat label="GURU+" value={masteredCount} note={`of ${items.length} learned kanji`} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap rounded-xl border border-white/10 bg-[#1d2028] p-1">
          {(['dashboard', 'lessons', 'reviews', 'browse', 'vocabulary'] as const).map((tab) => <button key={tab} type="button" onClick={() => setView(tab)} className={`rounded-lg px-3 py-2 text-sm ${view === tab ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>{tab === 'dashboard' ? 'Overview' : tab === 'lessons' ? `Lessons${lessonItems.length ? ` · ${lessonItems.length}` : ''}` : tab === 'reviews' ? `Reviews${dueItems.length ? ` · ${dueItems.length}` : ''}` : tab === 'browse' ? 'Kanji library' : 'Jukugo decks'}</button>)}
        </div>
        <div className="flex items-center gap-3"><button type="button" onClick={() => setMode('guided')} className="text-xs text-amber-200 hover:text-amber-100">← Guided JLPT path</button><button type="button" onClick={() => void loadItems()} className="text-xs text-gray-500 hover:text-white">Refresh</button></div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200">{error}</p>}

      {view === 'dashboard' ? (
        <section className="mt-5 rounded-2xl border border-white/10 bg-[#1d2028] p-5 sm:p-6">
          <div><p className="text-xs font-semibold tracking-[0.16em] text-amber-300">TODAY’S STUDY</p><h2 className="mt-2 text-2xl font-semibold text-white">Small batches, strong recall.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">First learn a few new characters. Later, answer meaning and reading separately; a kanji advances only when both are recalled.</p></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setView('lessons')} className="rounded-xl border border-sky-300/15 bg-sky-300/[0.05] p-5 text-left transition hover:border-sky-300/30"><span className="text-xs font-semibold tracking-wider text-sky-200">NEW KANJI</span><span className="mt-2 block text-3xl font-semibold text-white">{lessonItems.length}</span><span className="mt-1 block text-sm text-gray-400">{lessonItems.length ? 'Continue your lesson queue' : 'Add characters from the library'}</span></button>
            <button type="button" onClick={() => setView('reviews')} className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-5 text-left transition hover:border-amber-300/30"><span className="text-xs font-semibold tracking-wider text-amber-200">KANJI REVIEWS DUE</span><span className="mt-2 block text-3xl font-semibold text-white">{dueItems.length}</span><span className="mt-1 block text-sm text-gray-400">{dueItems.length ? 'Recall meaning, then reading' : nextDue ? `Next review ${readableTime(new Date(nextDue.due_at), clockNow)}` : 'No kanji reviews waiting'}</span></button>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#15171d] p-4"><div><p className="font-medium text-white">Practice kanji in words</p><p className="mt-1 text-sm text-gray-500">Save useful jukugo into decks and review their readings and meanings.</p></div><button type="button" onClick={() => setView('vocabulary')} className="rounded-lg bg-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/15">Open vocabulary decks</button></div>
        </section>
      ) : view === 'lessons' || view === 'reviews' ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="flex min-h-[22rem] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#1d2028] p-5 text-center sm:p-7">
            {loadingItems ? <p className="text-sm text-gray-500">Loading your kanji…</p> : view === 'lessons' && currentLesson ? (
              <div className="w-full max-w-xl">
                <div className="flex items-center justify-between text-xs text-gray-500"><span>NEW KANJI · {lessonItems.length} IN QUEUE</span><span>{lessonStep === 0 ? 'Learn' : `Check ${lessonStep} of 2`}</span></div>
                <div className="py-4 text-6xl font-medium text-white">{currentLesson.kanji}</div>
                {lessonStep === 0 ? <>
                  <p className="text-lg text-amber-200">{currentLesson.meanings.join(' · ')}</p>
                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><InfoBlock title="ON’YOMI" value={currentLesson.on_readings.join('、') || '—'} /><InfoBlock title="KUN’YOMI" value={currentLesson.kun_readings.join('、') || '—'} /></div>
                  <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#15171d] p-4 text-left"><p className="text-[10px] font-semibold tracking-wider text-gray-500">BUILD A MEMORY</p>{currentLesson.components?.length ? <div className="mt-3 flex flex-wrap gap-2">{currentLesson.components.map((part, index) => <span key={`${part.character}-${index}`} className="rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white"><span className="text-lg">{part.character}</span><span className="ml-2 text-gray-400">{part.meaning}</span></span>)}</div> : <p className="mt-2 text-sm leading-6 text-gray-500">Add the visual pieces in Browse kanji to build a story for this character.</p>}{currentLesson.mnemonic && <p className="mt-3 text-sm leading-6 text-gray-300">{currentLesson.mnemonic}</p>}</div>
                  <p className="mt-5 text-sm leading-6 text-gray-500">Study the pieces and readings. Then recall the meaning and one reading from memory. Both checks must be correct to finish this lesson.</p>
                  <button type="button" onClick={() => setLessonStep(1)} className="mt-5 w-full rounded-xl bg-[#fca311] px-5 py-3 text-sm font-semibold text-[#171717]">Start two-part check</button>
                </> : <form className="mx-auto max-w-md" onSubmit={(event) => void answerLesson(event)}><p className="text-xs font-semibold tracking-[0.18em] text-amber-300">{lessonStep === 1 ? 'MEANING' : 'READING'}</p><p className="mt-2 text-sm text-gray-400">{lessonStep === 1 ? 'What does this kanji mean?' : 'Recall one reading in kana.'}</p><div className="mt-4 flex gap-2"><input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={lessonStep === 1 ? 'Meaning' : 'Reading in kana'} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#15171d] px-4 py-3 text-sm text-white outline-none focus:border-amber-300/50" autoCapitalize="none" autoComplete="off" /><button disabled={!answer.trim()} className="rounded-xl bg-[#fca311] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">Check</button></div>{lessonFeedback && <p aria-live="polite" className="mt-3 text-sm text-amber-200">{lessonFeedback}</p>}<button type="button" onClick={() => { setLessonStep(0); setAnswer(''); setLessonFeedback(''); }} className="mt-4 text-xs text-gray-500 hover:text-white">Review lesson</button></form>}
              </div>
            ) : view === 'reviews' && shownReview ? (
              <div className="w-full max-w-xl">
                <div className="flex items-center justify-between text-xs text-gray-500"><span>{stageName(shownReview.srs_stage)}</span><span>{dueItems.length} due</span></div>
                <div className="py-5 text-6xl font-medium text-white">{shownReview.kanji}</div>
                {answered === null ? <>
                  <p className="text-xs font-semibold tracking-[0.18em] text-amber-300">{promptType === 'meaning' ? 'CHECK 1 OF 2 · MEANING' : 'CHECK 2 OF 2 · READING'}</p>
                  {reviewStep === 1 && <p className="mt-2 text-xs text-emerald-200">Meaning recalled. Now do the reading.</p>}
                  <form className="mx-auto mt-4 max-w-md" onSubmit={(event) => { event.preventDefault(); void submitReview(); }}><div className="flex gap-2"><input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={promptType === 'meaning' ? 'Type the meaning' : 'Type one reading in kana'} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#15171d] px-4 py-3 text-sm text-white outline-none focus:border-amber-300/50" autoCapitalize="none" autoComplete="off" /><button disabled={isLoading || !answer.trim()} className="rounded-xl bg-[#fca311] px-4 py-3 text-sm font-semibold text-[#171717] disabled:opacity-50">Check</button></div>{reviewFeedback && <p aria-live="polite" className="mt-3 text-sm text-amber-200">{reviewFeedback}</p>}</form>
                </> : <div className="mx-auto mt-4 max-w-md rounded-xl border border-white/10 bg-[#15171d] p-5 text-left"><p className="text-center text-lg font-semibold text-white">Review complete</p><div className="mt-4 space-y-3 text-sm"><p className={answered.meaning ? 'text-emerald-200' : 'text-rose-200'}>Meaning {answered.meaning ? '✓' : '✕'} <span className="text-gray-300">· {shownReview.meanings.join(' / ')}</span></p><p className={answered.reading ? 'text-emerald-200' : 'text-rose-200'}>Reading {answered.reading ? '✓' : '✕'} <span className="text-gray-300">· {[...shownReview.on_readings, ...shownReview.kun_readings].join(' / ')}</span></p></div><p className="mt-4 text-center text-xs text-gray-500">{answered.meaning && answered.reading ? shownReview.srs_stage >= 8 ? 'Burned · removed from reviews' : `Both correct · next review in ${readableTime(new Date(shownReview.due_at))}` : `One answer missed · moved to ${stageName(shownReview.srs_stage)} · try again in 10 min`}</p><button type="button" onClick={continueReview} className="mt-4 w-full rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">Continue</button></div>}
              </div>
            ) : view === 'reviews' && nextDue ? <div><p className="text-5xl">⏳</p><h2 className="mt-5 text-xl font-semibold text-white">Reviews are learning</h2><p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">Your next kanji is due in {readableTime(new Date(nextDue.due_at), clockNow)}. It will appear here automatically.</p><div className="mt-6 text-5xl text-white">{nextDue.kanji}</div><p className="mt-2 text-sm text-gray-500">{stageName(nextDue.srs_stage)}</p></div> : view === 'lessons' ? <div><p className="text-5xl text-emerald-200">✓</p><h2 className="mt-5 text-xl font-semibold text-white">Lesson queue clear</h2><p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">New kanji are taught before their spaced reviews begin. Choose a level to add your next small batch.</p><button type="button" onClick={() => setView('browse')} className="mt-5 rounded-lg bg-[#fca311] px-4 py-2.5 text-sm font-semibold text-[#171717]">Choose kanji</button></div> : <div><p className="text-5xl text-emerald-200">✓</p><h2 className="mt-5 text-xl font-semibold text-white">Reviews complete</h2><p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">Nothing is due now. Your next review will appear here when its interval ends.</p><button type="button" onClick={() => setView('dashboard')} className="mt-5 rounded-lg bg-white/10 px-4 py-2.5 text-sm text-white">Back to overview</button></div>}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-white/[0.08] bg-[#1d2028] p-5"><p className="text-xs font-semibold tracking-wider text-gray-500">YOUR SRS STAGES</p><div className="mt-4 space-y-3">{stageGroups.map((group) => { const count = items.filter((item) => group.stages.includes(item.srs_stage)).length; return <div key={group.title}><div className="flex justify-between text-sm"><span className="text-gray-300">{group.title}</span><span className="text-gray-500">{count}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className={`h-full ${group.color}`} style={{ width: `${items.length ? count / items.length * 100 : 0}%` }} /></div></div>; })}</div><p className="mt-4 text-[11px] leading-5 text-gray-600">Correct answers advance one stage. Misses move items back; burned kanji leave the review queue.</p></section>
            <section className="rounded-2xl border border-white/[0.08] bg-[#1d2028] p-5"><p className="text-xs font-semibold tracking-wider text-gray-500">HOW THIS REVIEW WORKS</p><p className="mt-3 text-sm leading-6 text-gray-400">Each kanji review asks for its meaning and then a reading. Both answers are recorded separately; missing either sends the kanji back for another short interval.</p><p className="mt-3 text-xs text-gray-600">Meanings, readings, and example words by <a href="https://kanjiapi.dev/" target="_blank" rel="noreferrer" className="text-gray-400 underline decoration-white/20 underline-offset-2">kanjiapi.dev</a>.</p></section>
          </aside>
        </div>
      ) : view === 'vocabulary' ? (
        <KanjiDecks client={client} user={session.user} kanji={items.map((item) => item.kanji)} />
      ) : (
        <section className="mt-5 rounded-2xl border border-white/10 bg-[#1d2028] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold text-white">Explore the kanji</h2><p className="mt-1 text-sm text-gray-500">Choose a kanji to see readings and add it to your lessons.</p></div><label className="text-xs text-gray-500">JLPT level<select value={level} onChange={(event) => setLevel(event.target.value)} className="ml-2 rounded-lg border border-white/10 bg-[#15171d] px-3 py-2 text-sm text-gray-200 outline-none"><option value="5">N5 · beginner</option><option value="4">N4 · elementary</option><option value="3">N3 · intermediate</option><option value="2">N2 · upper intermediate</option><option value="1">N1 · advanced</option></select></label></div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a character, e.g. 日" className="mt-5 w-full rounded-xl border border-white/10 bg-[#15171d] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-amber-300/40" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-gray-500">Select several characters to add them to your lesson queue at once. {selectedForLessons.size} selected.</p><div className="flex gap-2"><button type="button" onClick={() => setSelectedForLessons(new Set(filteredCatalog.filter((character) => !savedKanji.has(character))))} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300">Select visible</button><button type="button" disabled={!selectedForLessons.size || bulkSaving} onClick={() => void addSelectedLessons()} className="rounded-lg bg-[#fca311] px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{bulkSaving ? 'Adding…' : `Add ${selectedForLessons.size} to lessons`}</button></div></div>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">{loadingCatalog ? <p className="col-span-full py-10 text-center text-sm text-gray-500">Loading kanji list…</p> : filteredCatalog.map((character) => <div key={character} className={`relative aspect-square rounded-xl border transition hover:border-amber-300/40 ${selectedKanji?.kanji === character ? 'border-amber-300/50 bg-amber-300/[0.08]' : 'border-white/[0.07] bg-[#15171d]'}`}><button type="button" onClick={() => void openKanji(character)} className="flex h-full w-full items-center justify-center text-3xl text-white" aria-label={`Open ${character}`}>{character}</button><input type="checkbox" checked={selectedForLessons.has(character)} disabled={savedKanji.has(character)} onChange={(event) => setSelectedForLessons((old) => { const next = new Set(old); if (event.target.checked) next.add(character); else next.delete(character); return next; })} aria-label={`Select ${character} for lessons`} className="absolute right-1 top-1 h-4 w-4 accent-amber-400 disabled:opacity-30" />{savedKanji.has(character) && <span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />}</div>)}</div>
          {!loadingCatalog && filteredCatalog.length === 0 && <p className="py-10 text-center text-sm text-gray-500">No characters match that search.</p>}
          {selectedKanji && <div className="mt-6 rounded-2xl border border-amber-300/15 bg-[#15171d] p-5"><div className="flex flex-wrap items-start gap-5"><div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] text-6xl text-white">{selectedKanji.kanji}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-semibold text-white">{selectedKanji.meanings.join(' · ')}</h3>{selectedKanji.jlpt && <span className="rounded-full bg-sky-300/10 px-2.5 py-1 text-[10px] font-semibold text-sky-200">N{selectedKanji.jlpt}</span>}</div><p className="mt-2 text-sm text-amber-200">On: {selectedKanji.on_readings.join('、') || '—'}</p><p className="mt-1 text-sm text-gray-300">Kun: {selectedKanji.kun_readings.join('、') || '—'}</p><p className="mt-2 text-xs text-gray-500">{selectedKanji.stroke_count} strokes {selectedKanji.grade ? `· school grade ${selectedKanji.grade}` : ''}</p></div><button type="button" disabled={saving} onClick={() => void (savedKanji.has(selectedKanji.kanji) ? saveComponents() : addToLessons())} className="shrink-0 rounded-xl bg-[#fca311] px-4 py-3 text-sm font-semibold text-[#171717] disabled:opacity-50">{saving ? 'Saving…' : savedKanji.has(selectedKanji.kanji) ? 'Save details' : 'Add to lessons'}</button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold tracking-wide text-gray-400">COMPONENTS · one per line: character — meaning<textarea value={partsInput} onChange={(e) => setPartsInput(e.target.value)} placeholder={'七 — seven\n魚 — fish\n一 — one'} rows={4} className="mt-2 w-full rounded-xl border border-white/10 bg-[#1d2028] px-3 py-3 text-sm font-normal text-white placeholder:text-gray-600" /></label><label className="text-xs font-semibold tracking-wide text-gray-400">YOUR MNEMONIC<textarea value={mnemonic} onChange={(e) => setMnemonic(e.target.value)} placeholder="Make a short story from the pieces to remember this kanji…" rows={4} className="mt-2 w-full rounded-xl border border-white/10 bg-[#1d2028] px-3 py-3 text-sm font-normal text-white placeholder:text-gray-600" /></label></div></div>}
        </section>
      )}

      {items.length > 0 && <section className="mt-5 rounded-2xl border border-white/10 bg-[#1d2028] p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-white">Your kanji library</h2><span className="text-xs text-gray-500">{items.length} total</span></div><div className="mt-4 flex flex-wrap gap-2">{items.map((item) => <button key={item.id} type="button" onClick={() => { setView('browse'); void openKanji(item.kanji); }} title={`${item.meanings.join(', ')} · ${stageName(item.srs_stage)}`} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-[#15171d] px-3 py-2"><span className="text-xl text-white">{item.kanji}</span><span className="text-[10px] text-gray-500">{stageName(item.srs_stage)}</span></button>)}</div></section>}
    </KanjiFrame>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-[#1d2028] p-4"><p className="text-[10px] font-semibold tracking-[0.16em] text-gray-500">{label}</p><div className="mt-2 flex items-end justify-between"><span className="text-3xl font-semibold text-white">{value}</span><span className="text-xs text-gray-600">{note}</span></div></div>;
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-[#15171d] p-3"><p className="text-[10px] font-semibold tracking-wider text-gray-600">{title}</p><p className="mt-1 text-sm text-gray-200">{value}</p></div>;
}

function KanjiFrame({ children }: { children: ReactNode }) {
  return <main className="min-h-[calc(100dvh-3.5rem)] bg-[#15171d] px-4 py-5 text-gray-100 sm:px-8 sm:py-7"><div className="mx-auto max-w-6xl">{children}</div></main>;
}

function AuthNotice() {
  return <section className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#1d2028] p-6 text-center"><div className="text-3xl text-amber-300">漢</div><h1 className="mt-4 text-2xl font-semibold text-white">Kanji Corner</h1><p className="mt-2 text-sm text-gray-400">Set up Supabase to save your study progress.</p></section>;
}
