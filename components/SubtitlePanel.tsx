'use client';

import React, { useRef, useEffect } from 'react';
import type { SubtitleLine } from '@/lib/types';

interface SubtitlePanelProps {
  subtitles: SubtitleLine[];
  activeIndex: number;
  onLineClick: (subtitle: SubtitleLine) => void;
  onMineLine: (subtitle: SubtitleLine) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SubtitlePanel({
  subtitles,
  activeIndex,
  onLineClick,
  onMineLine,
}: SubtitlePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active subtitle
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeRef.current;
      const containerTop = container.scrollTop;
      const containerBottom = containerTop + container.clientHeight;
      const activeTop = active.offsetTop;
      const activeBottom = activeTop + active.clientHeight;

      if (activeTop < containerTop + 60 || activeBottom > containerBottom - 60) {
        active.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeIndex]);

  if (subtitles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2 py-8">
        <div className="text-3xl">📄</div>
        <p>No subtitles loaded.</p>
        <p className="text-xs text-center max-w-xs">
          Load a video and paste VTT/SRT subtitle text, or use the subtitle
          import button.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto h-full pr-1"
      style={{ scrollbarGutter: 'stable' }}
    >
      {subtitles.map((sub, i) => {
        const isActive = i === activeIndex;
        return (
          <div
            key={sub.index}
            ref={isActive ? activeRef : null}
            className={`subtitle-line group flex items-start gap-3 px-3 py-2 cursor-pointer rounded-sm ${
              isActive ? 'subtitle-active' : ''
            }`}
            onClick={() => onLineClick(sub)}
          >
            {/* Timestamp */}
            <span className="text-xs text-gray-500 font-mono pt-0.5 shrink-0 w-9 text-right">
              {formatTime(sub.startTime)}
            </span>

            {/* Text */}
            <span
              className={`flex-1 text-sm leading-relaxed ${
                isActive ? 'text-white' : 'text-gray-300'
              }`}
            >
              {sub.text}
            </span>

            {/* Mine button (visible on hover) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMineLine(sub);
              }}
              className="shrink-0 opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded text-xs bg-[#fca311] text-black font-semibold transition-opacity hover:bg-amber-400"
              title="Mine this line"
            >
              ⛏
            </button>
          </div>
        );
      })}
    </div>
  );
}
