'use client';

import { useCallback, useRef } from 'react';
import YouTube, { type YouTubeProps, type YouTubePlayer } from 'react-youtube';

interface StudyCardClipProps {
  videoId: string;
  startAt: number;
  endAt: number | null;
}

export default function StudyCardClip({ videoId, startAt, endAt }: StudyCardClipProps) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const start = Math.max(0, startAt);
  const end = endAt !== null && endAt > start ? endAt : undefined;

  const opts: YouTubeProps['opts'] = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      playsinline: 1,
    },
  };

  const playClip = useCallback((player: YouTubePlayer | null) => {
    if (!player) return;

    const boundedPlayer = player as unknown as {
      loadVideoById: (options: {
        videoId: string;
        startSeconds: number;
        endSeconds?: number;
      }) => unknown;
    };
    boundedPlayer.loadVideoById({
      videoId,
      startSeconds: start,
      ...(end !== undefined ? { endSeconds: end } : {}),
    });
  }, [videoId, start, end]);

  const replay = useCallback(() => {
    playClip(playerRef.current);
  }, [playClip]);

  const onReady = useCallback<NonNullable<YouTubeProps['onReady']>>((event) => {
    playerRef.current = event.target;
    playClip(event.target);
  }, [playClip]);

  const formatPreciseTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds - minutes * 60;
    return `${minutes}:${remainder.toFixed(2).padStart(5, '0')}`;
  };

  return (
    <div className="mt-6 w-full">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
        <YouTube
          videoId={videoId}
          opts={opts}
          onReady={onReady}
          className="absolute inset-0 h-full w-full"
          iframeClassName="h-full w-full"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">
          Source clip · {formatPreciseTime(start)}{end !== undefined ? `–${formatPreciseTime(end)}` : ''}
        </span>
        <button
          type="button"
          onClick={replay}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-amber-300/30 hover:text-amber-200"
        >
          ↺ Replay clip
        </button>
      </div>
    </div>
  );
}
