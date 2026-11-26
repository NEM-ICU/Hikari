'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export default function AccountMenu({ client, email }: { client: SupabaseClient; email: string }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('mousedown', closeOnOutsideClick);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [open]);

  const signOut = async () => {
    setSigningOut(true);
    setError('');
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      setSigningOut(false);
    } else {
      setOpen(false);
      setSigningOut(false);
    }
  };

  return <div ref={menuRef} className="relative">
    <button
      type="button"
      onClick={() => { setError(''); setOpen((current) => !current); }}
      aria-expanded={open}
      aria-controls="account-actions-popover"
      className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-gray-200 dark:hover:bg-white/10"
    >
      <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-800 dark:bg-orange-400/15 dark:text-orange-200">{email.slice(0, 1).toUpperCase()}</span>
      <span className="hidden sm:inline">Profile</span>
      <span aria-hidden="true" className="text-[10px] text-slate-500 dark:text-gray-400">▾</span>
    </button>

    {open && <div id="account-actions-popover" aria-label="Account menu" className="absolute right-0 top-[calc(100%+0.5rem)] z-[70] w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/15 dark:border-white/10 dark:bg-[#222732]">
      <div className="border-b border-slate-200 px-3 py-2.5 dark:border-white/10">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">Signed in as</p>
        <p className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-gray-100">{email}</p>
      </div>
      {error && <p role="alert" className="px-3 pt-2 text-xs text-red-700 dark:text-red-200">{error}</p>}
      <button type="button" onClick={() => void signOut()} disabled={signingOut} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-orange-50 hover:text-orange-800 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-orange-400/10 dark:hover:text-orange-200">
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>}
  </div>;
}
