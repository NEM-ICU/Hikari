'use client';

import React, { useCallback } from 'react';
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube';

interface VideoPlayerProps {
  videoId: string;
  onPlayerReady: (player: YouTubePlayer) => void;
}

export default function VideoPlayer({ videoId, onPlayerReady }: VideoPlayerProps) {
  const opts: YouTubeProps['opts'] = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1,
      // The app provides its own playback controls below the video.
      controls: 0,
      rel: 0,
      cc_load_policy: 0,
      iv_load_policy: 3,
      playsinline: 1,
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
        className="relative bg-black"
        style={{
          // Keep space for the controls and a useful portion of the subtitle list.
          height: 'min(55dvh, 36.5625vw)',
          maxHeight: 'calc(100dvh - 20rem)',
          aspectRatio: '16/9',
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
