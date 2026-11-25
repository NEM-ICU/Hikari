'use client';

import React, { useRef, useCallback } from 'react';
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube';

interface VideoPlayerProps {
  videoId: string;
  onPlayerReady: (player: YouTubePlayer) => void;
}

export default function VideoPlayer({ videoId, onPlayerReady }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const opts: YouTubeProps['opts'] = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      rel: 0,
      modestbranding: 1,
      cc_load_policy: 0,
    },
  };

  const onReady = useCallback<NonNullable<YouTubeProps['onReady']>>(
    (event) => {
      onPlayerReady(event.target);
    },
    [onPlayerReady]
  );

  return (
    <div
      className="flex w-full justify-center bg-black"
    >
      <div
        ref={containerRef}
        className="relative bg-black"
        style={{
          aspectRatio: '16/9',
          // Keep space for the controls and a useful portion of the subtitle list.
          height: 'min(55dvh, 36.5625vw)',
          maxHeight: 'calc(100dvh - 20rem)',
        }}
      >
        <YouTube
          videoId={videoId}
          opts={opts}
          onReady={onReady}
          className="absolute inset-0 w-full h-full"
          iframeClassName="w-full h-full"
        />
      </div>
    </div>
  );
}
