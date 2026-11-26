'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import AccountMenu from '@/components/AccountMenu';
import ThemeToggle from '@/components/ThemeToggle';
import { useSupabaseSession } from '@/lib/useSupabaseSession';

interface HeaderProps {
  videoUrl: string;
  onVideoUrlChange: (url: string) => void;
  onLoadVideo: () => void;
}

export default function Header({
  videoUrl,
  onVideoUrlChange,
  onLoadVideo,
}: HeaderProps) {
  const { client, session } = useSupabaseSession();
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') onLoadVideo();
    },
    [onLoadVideo]
  );

  return (
    <header className="flex flex-col items-center gap-3 border-b border-gray-700/50 bg-[#222732] px-4 py-2.5 sm:flex-row">
      {/* Logo */}
      <div className="flex shrink-0 items-center gap-3">
        <Link href="/" className="flex items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fca311]" aria-label="Hikari home">
          <div className="w-8 h-8 rounded-lg bg-[#fca311] flex items-center justify-center shadow-sm shadow-amber-500/20">
            <span className="text-black font-black text-sm" aria-hidden="true">光</span>
          </div>
          <span className="font-bold text-lg tracking-tight" aria-label="Hikari">
            <span className="text-white">Hikari</span>
          </span>
        </Link>
      </div>

      {/* URL Input */}
      <div className="flex flex-1 w-full gap-2">
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => onVideoUrlChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste YouTube URL or video ID…"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#1a1d24] border border-gray-600 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#fca311] focus:ring-1 focus:ring-[#fca311] transition-colors"
        />
        <button
          onClick={onLoadVideo}
          className="px-4 py-2 rounded-lg bg-[#fca311] text-black font-semibold text-sm hover:bg-amber-400 active:bg-amber-600 transition-colors whitespace-nowrap"
        >
          Load
        </button>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {client && session && <AccountMenu client={client} email={session.user.email ?? 'Account'} />}
        <ThemeToggle />
      </div>
    </header>
  );
}
