'use client';

import React from 'react';
import type { YouTubePlayer } from 'react-youtube';

interface PlaybackControlsProps {
  player: YouTubePlayer | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeekRelative: (seconds: number) => void;
  onMineLine: () => void;
  isMining: boolean;
}

export default function PlaybackControls({
  player,
  isPlaying,
  onTogglePlay,
  onSeekRelative,
  onMineLine,
  isMining,
}: PlaybackControlsProps) {
  const btnBase =
    'flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#fca311] focus:ring-offset-1 focus:ring-offset-[#1a1d24]';

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#222732] border-t border-gray-700/50">
      {/* Seek back */}
      <button
        onClick={() => onSeekRelative(-3)}
        disabled={!player}
        className={`${btnBase} px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm`}
        title="Seek back 3s (←)"
      >
        ◀ 3s
      </button>

      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        disabled={!player}
        className={`${btnBase} px-4 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm min-w-[4rem]`}
        title="Play/Pause (Space)"
      >
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>

      {/* Seek forward */}
      <button
        onClick={() => onSeekRelative(3)}
        disabled={!player}
        className={`${btnBase} px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm`}
        title="Seek forward 3s (→)"
      >
        3s ▶
      </button>

      <div className="flex-1" />

      {/* Mine Line */}
      <button
        onClick={onMineLine}
        disabled={!player || isMining}
        className={`${btnBase} px-4 py-1.5 font-semibold text-sm gap-2 ${
          isMining
            ? 'bg-amber-800 text-amber-200 cursor-wait'
            : 'bg-[#fca311] hover:bg-amber-400 text-black disabled:opacity-40 disabled:cursor-not-allowed'
        }`}
        title="Mine current line (M)"
      >
        {isMining ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-amber-200 border-t-transparent rounded-full animate-spin" />
            Mining…
          </>
        ) : (
          '⛏ Mine Line'
        )}
      </button>

      {/* Keyboard hint */}
      <div className="hidden lg:flex items-center gap-1 text-xs text-gray-500 ml-2">
        <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">Space</kbd>
        <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">M</kbd>
      </div>
    </div>
  );
}
