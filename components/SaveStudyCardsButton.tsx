'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MinedData } from '@/lib/types';
import { useSupabaseSession } from '@/lib/useSupabaseSession';
import { buildStudyCardRows } from '@/lib/studyCards';
import EmailMagicLink from '@/components/EmailMagicLink';

const PENDING_SAVE_KEY = 'hikari-pending-study-card-save';

interface SavePayload {
  minedData: MinedData;
  videoId: string;
  timestamp: number;
  videoStartTimestamp: number;
  videoEndTimestamp: number;
}

interface SaveStudyCardsButtonProps {
  minedData: MinedData | null;
  videoId: string;
  timestamp: number;
  videoStartTimestamp: number;
  videoEndTimestamp: number;
  onSaved: (count: number) => void;
}

function describeSaveError(error: unknown) {
  const supabaseError = error as { code?: string; message?: string };
  const message = supabaseError?.message ?? '';
  if (
    supabaseError?.code === 'PGRST204' ||
    message.includes('source_end_timestamp') ||
    message.toLowerCase().includes('schema cache')
  ) {
    return 'Your Supabase table needs the latest clip-time columns. Run the study_cards ALTER TABLE SQL in Supabase, then try again.';
  }
  return message || 'Could not save cards.';
}

export default function SaveStudyCardsButton({
  minedData,
  videoId,
  timestamp,
  videoStartTimestamp,
  videoEndTimestamp,
  onSaved,
}: SaveStudyCardsButtonProps) {
  const { client, session } = useSupabaseSession();
  const [showSignIn, setShowSignIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pendingSaveHandled = useRef(false);

  const saveCards = useCallback(async (payload: SavePayload, userId: string) => {
    if (!client) throw new Error('Supabase is not configured. Add the project URL and anon key.');

    const rows = buildStudyCardRows(
      payload.minedData,
      payload.videoId,
      payload.timestamp,
      userId,
      new Date(),
      payload.videoStartTimestamp,
      payload.videoEndTimestamp
    );
    const { error: insertError } = await client.from('study_cards').insert(rows);
    if (insertError) throw new Error(describeSaveError(insertError));
    return rows.length;
  }, [client]);

  useEffect(() => {
    if (!client || !session || pendingSaveHandled.current) return;

    const rawPendingSave = window.sessionStorage.getItem(PENDING_SAVE_KEY);
    if (!rawPendingSave) return;

    pendingSaveHandled.current = true;
    window.sessionStorage.removeItem(PENDING_SAVE_KEY);
    setSaving(true);
    let pendingSave: SavePayload;
    try {
      pendingSave = JSON.parse(rawPendingSave) as SavePayload;
    } catch {
      setError('The saved card draft could not be read. Mine the sentence again to save it.');
      setSaving(false);
      return;
    }
    saveCards(pendingSave, session.user.id)
      .then((count) => {
        onSaved(count);
      })
      .catch((saveError: unknown) => {
        window.sessionStorage.setItem(PENDING_SAVE_KEY, rawPendingSave);
        setError(saveError instanceof Error ? saveError.message : describeSaveError(saveError));
      })
      .finally(() => setSaving(false));
  }, [client, session, saveCards, onSaved]);

  const handleSave = async () => {
    setError('');
    if (!minedData) return;
    if (!client) {
      setError('Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable your card library.');
      return;
    }

    const payload = { minedData, videoId, timestamp, videoStartTimestamp, videoEndTimestamp };
    if (!session) {
      window.sessionStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(payload));
      setShowSignIn(true);
      return;
    }

    setSaving(true);
    try {
      const count = await saveCards(payload, session.user.id);
      onSaved(count);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : describeSaveError(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSave}
        disabled={!minedData || !minedData.sentence_jp.trim() || saving}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-300/[0.16] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving
          ? 'Saving cards…'
          : minedData
            ? `Save to Hikari Library (${minedData.cards.length + 1})`
            : 'Save to Hikari Library'}
      </button>

      {!minedData && (
        <p className="text-center text-xs text-gray-500">Mine a subtitle line to create a sentence card and its vocabulary cards.</p>
      )}

      {showSignIn && client && !session && (
        <div className="rounded-xl border border-white/10 bg-[#1a1d24] p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Save your cards across devices</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">Sign in or create an account with a secure email link.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowSignIn(false)}
              aria-label="Close sign-in panel"
              className="text-lg leading-none text-gray-500 hover:text-white"
            >×</button>
          </div>
          <EmailMagicLink client={client} redirectTo={window.location.href} />
        </div>
      )}

      {error && <p role="alert" className="text-xs leading-5 text-red-300">{error}</p>}
    </div>
  );
}
