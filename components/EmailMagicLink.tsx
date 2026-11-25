'use client';

import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

interface EmailMagicLinkProps {
  client: SupabaseClient;
  redirectTo?: string;
}

export default function EmailMagicLink({ client, redirectTo }: EmailMagicLinkProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const sendLink = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');

    const { error: authError } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo ?? `${window.location.origin}/cards`,
        shouldCreateUser: true,
      },
    });

    if (authError) setError(authError.message);
    else setMessage('Check your email for a sign-in link.');
    setBusy(false);
  };

  return (
    <form onSubmit={sendLink} className="space-y-3">
      <label className="block text-left text-xs font-medium text-gray-400" htmlFor="study-email">
        Email address
      </label>
      <input
        id="study-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/10"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-[#fca311] px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </form>
  );
}
