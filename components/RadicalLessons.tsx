'use client';

import { useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { CurriculumLevel } from '@/lib/kanjiCurriculum';

export default function RadicalLessons({ client, user, level, curriculum, progress, onProgress }: {
  client: SupabaseClient; user: User; level: number; curriculum: CurriculumLevel;
  progress: Record<string, string[]>; onProgress: (next: Record<string, string[]>) => void;
}) {
  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const completed = progress[String(level)] ?? [];
  const radical = curriculum.radicals[active];
  const finish = async () => {
    if (!radical || saving) return;
    const nextLevel = [...new Set([...completed, radical.character])];
    const next = { ...progress, [String(level)]: nextLevel };
    setSaving(true); setError('');
    const { error: saveError } = await client.from('kanji_profiles').update({ radical_progress: next, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    if (saveError) setError(saveError.message);
    else {
      onProgress(next);
      setRevealed(false);
      const nextIndex = curriculum.radicals.findIndex((entry) => !nextLevel.includes(entry.character));
      setActive(nextIndex < 0 ? 0 : nextIndex);
    }
    setSaving(false);
  };
  const firstUnlearned = curriculum.radicals.findIndex((entry) => !completed.includes(entry.character));
  const allComplete = firstUnlearned < 0;
  const current = allComplete ? null : curriculum.radicals[firstUnlearned];

  return <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="rounded-2xl border border-white/10 bg-[#1d2028] p-6 text-center sm:p-8">
      {current ? <div className="mx-auto max-w-xl">
        <p className="text-xs font-semibold tracking-wider text-emerald-200">RADICAL LESSON · {completed.length}/{curriculum.radicals.length} COMPLETE</p>
        <div className="mx-auto mt-6 flex h-40 w-40 flex-col items-center justify-center rounded-3xl border border-emerald-200/15 bg-gradient-to-br from-emerald-300/10 to-sky-300/10">
          <span className="text-6xl" role="img" aria-label={current.meaning}>{current.visual}</span>
          <span className="mt-2 text-4xl font-medium text-white">{current.character}</span>
        </div>
        {revealed ? <><h2 className="mt-5 text-2xl font-semibold capitalize text-emerald-100">{current.meaning}</h2><p className="mt-2 text-sm text-gray-400">Use the picture and shape together as a quick memory cue.</p><button type="button" onClick={() => void finish()} disabled={saving} className="mt-6 w-full rounded-xl bg-[#fca311] px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">{saving ? 'Saving…' : 'Got it · next radical'}</button></> : <button type="button" onClick={() => setRevealed(true)} className="mt-6 w-full rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15">Reveal meaning</button>}
      </div> : <div className="py-12"><p className="text-5xl">✨</p><h2 className="mt-4 text-2xl font-semibold text-white">Radicals complete</h2><p className="mt-2 text-sm text-gray-400">All {curriculum.radicals.length} visual building blocks are ready for kanji lessons.</p></div>}
      {error && <p role="alert" className="mt-4 text-sm text-red-200">{error}</p>}
    </div>
    <aside className="rounded-2xl border border-white/10 bg-[#1d2028] p-5"><p className="text-xs font-semibold tracking-wider text-gray-500">RADICAL SET · {completed.length}/{curriculum.radicals.length}</p><div className="mt-3 grid grid-cols-3 gap-2">{curriculum.radicals.map((item) => <div key={item.character} title={item.meaning} className={`rounded-xl p-3 ${completed.includes(item.character) ? 'bg-emerald-300/10' : 'bg-[#15171d]'}`}><span className="block text-xl">{item.visual}</span><span className="mt-1 block text-lg text-white">{item.character}</span><span className="block truncate text-[10px] capitalize text-gray-500">{item.meaning}</span></div>)}</div></aside>
  </section>;
}
