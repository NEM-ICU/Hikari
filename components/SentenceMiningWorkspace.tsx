'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import type { YouTubePlayer } from 'react-youtube';
import dynamic from 'next/dynamic';

import Header from '@/components/Header';
import SubtitlePanel from '@/components/SubtitlePanel';
import PlaybackControls from '@/components/PlaybackControls';
import MiningPreview from '@/components/MiningPreview';
import SubtitleImport from '@/components/SubtitleImport';

import { parseVTT, parseSRT, findActiveSubtitle, extractVideoId } from '@/lib/subtitleParser';
import { checkConnection, getDecksAndModels, pushCardsToAnki } from '@/lib/ankiConnect';
import type { SubtitleLine, MinedData } from '@/lib/types';

// Dynamically import VideoPlayer to avoid SSR issues with react-youtube
const VideoPlayer = dynamic(() => import('@/components/VideoPlayer'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full bg-black flex items-center justify-center text-gray-500"
      style={{ aspectRatio: '16/9' }}
    >
      Loading player…
    </div>
  ),
});

export default function KotoMinePage() {
  // Video state
  const [videoUrl, setVideoUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Subtitle state
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [captionStatus, setCaptionStatus] = useState('');
  const [aiProvider, setAiProvider] = useState('ollama');

  // Mining state
  const [minedData, setMinedData] = useState<MinedData | null>(null);
  const [mineTimestamp, setMineTimestamp] = useState(0);
  const [mineStartTimestamp, setMineStartTimestamp] = useState(0);
  const [mineEndTimestamp, setMineEndTimestamp] = useState(0);
  const [isMining, setIsMining] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);

  // Anki state
  const [ankiConnected, setAnkiConnected] = useState(false);
  const [availableDecks, setAvailableDecks] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [deckName, setDeckName] = useState('Default');
  const [sentenceModelName, setSentenceModelName] = useState('');
  const [vocabModelName, setVocabModelName] = useState('');
  const [isPushing, setIsPushing] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3500);
    },
    []
  );

  const handleCardsSaved = useCallback(({ saved, skipped }: { saved: number; skipped: number }) => {
    if (saved === 0 && skipped > 0) {
      showToast(`Already in your Hikari Library — skipped ${skipped} duplicate ${skipped === 1 ? 'card' : 'cards'}`, 'success');
    } else if (skipped > 0) {
      showToast(`Saved ${saved} new ${saved === 1 ? 'card' : 'cards'}; skipped ${skipped} already in your library`, 'success');
    } else {
      showToast(`Saved ${saved} ${saved === 1 ? 'card' : 'cards'} to your Hikari Library`, 'success');
    }
  }, [showToast]);

  // ─── Anki connection polling ───────────────────────────────────────────────
  const refreshAnki = useCallback(async () => {
    const connected = await checkConnection();
    setAnkiConnected(connected);

    if (connected) {
      try {
        const { decks, models } = await getDecksAndModels();
        setAvailableDecks(decks);
        setAvailableModels(models);
        if (decks.length > 0 && !deckName) setDeckName(decks[0]);
        if (models.length > 0 && !sentenceModelName)
          setSentenceModelName(models[0]);
        if (models.length > 0 && !vocabModelName) setVocabModelName(models[0]);
      } catch {
        // ignore
      }
    }
  }, [deckName, sentenceModelName, vocabModelName]);

  useEffect(() => {
    refreshAnki();
    const interval = setInterval(refreshAnki, 5000);
    return () => clearInterval(interval);
  }, [refreshAnki]);

  // ─── Active subtitle polling ───────────────────────────────────────────────
  useEffect(() => {
    if (!playerRef.current || subtitles.length === 0) return;

    const interval = setInterval(() => {
      try {
        const time = playerRef.current?.getCurrentTime() ?? 0;
        const idx = findActiveSubtitle(subtitles, time);
        setActiveIndex(idx);
      } catch {
        // Player may not be ready yet
      }
    }, 100);

    return () => clearInterval(interval);
  }, [subtitles]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT';

      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleMineLine();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeekRelative(-3);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeekRelative(3);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, subtitles, isMining]);

  // ─── Video loading ─────────────────────────────────────────────────────────
  const handleLoadVideo = useCallback(() => {
    const id = extractVideoId(videoUrl.trim());
    if (!id) {
      showToast('Invalid YouTube URL or video ID', 'error');
      return;
    }
    setVideoId(id);
    setSubtitles([]);
    setActiveIndex(-1);
    setMinedData(null);
    setCaptionStatus('Loading YouTube captions…');
  }, [videoUrl, showToast]);

  // Fetch YouTube's available caption track after loading a video.
  useEffect(() => {
    if (!videoId) return;
    const controller = new AbortController();

    const loadCaptions = async () => {
      try {
        const response = await fetch(
          `/api/subtitles?videoId=${encodeURIComponent(videoId)}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Captions unavailable');

        const parsed = parseVTT(data.vtt ?? '');
        if (parsed.length === 0) throw new Error('YouTube returned no usable captions');
        setSubtitles(parsed);
        setActiveIndex(-1);
        setCaptionStatus(`Loaded ${parsed.length} ${data.langCode || ''} caption lines`);
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        setCaptionStatus(`Could not load YouTube captions: ${message}`);
      }
    };

    loadCaptions();
    return () => controller.abort();
  }, [videoId]);

  // ─── Player controls ───────────────────────────────────────────────────────
  const handlePlayerReady = useCallback((player: YouTubePlayer) => {
    playerRef.current = player;
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (!playerRef.current) return;
    const state = playerRef.current.getPlayerState();
    if (state === 1) {
      // playing
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  }, []);

  const handleSeekRelative = useCallback((delta: number) => {
    if (!playerRef.current) return;
    const time = playerRef.current.getCurrentTime();
    playerRef.current.seekTo(Math.max(0, time + delta), true);
  }, []);

  const handleSubtitleClick = useCallback((subtitle: SubtitleLine) => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(subtitle.startTime, true);
  }, []);

  // ─── Subtitle import ───────────────────────────────────────────────────────
  const handleImportSubtitles = useCallback(
    (text: string, format: 'vtt' | 'srt') => {
      const parsed =
        format === 'srt' ? parseSRT(text) : parseVTT(text);
      if (parsed.length === 0) {
        showToast('Could not parse subtitles — check format', 'error');
        return;
      }
      setSubtitles(parsed);
      showToast(`Loaded ${parsed.length} subtitle lines`, 'success');
    },
    [showToast]
  );

  // ─── Mining ────────────────────────────────────────────────────────────────
  const handleMineLine = useCallback(
    async (subtitle?: SubtitleLine) => {
      const target = subtitle ?? subtitles[activeIndex];
      if (!target || isMining) return;

      const time = playerRef.current?.getCurrentTime() ?? target.startTime;
      setMineTimestamp(time);
      setMineStartTimestamp(target.startTime);
      setMineEndTimestamp(target.endTime);
      setIsMining(true);
      setMineError(null);

      const before = subtitles[activeIndex - 1]?.text ?? '';
      const after = subtitles[activeIndex + 1]?.text ?? '';

      try {
        const response = await fetch('/api/mine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetSentence: target.text,
            contextBefore: before,
            contextAfter: after,
            videoId,
            timestamp: time,
            provider: aiProvider,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const data: MinedData = await response.json();
        setMinedData(data);
        showToast(`Mined ${data.cards.length} vocabulary cards!`, 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Mining failed';
        setMineError(msg);
        showToast(msg, 'error');
      } finally {
        setIsMining(false);
      }
    },
    [subtitles, activeIndex, isMining, videoId, showToast, aiProvider]
  );

  // ─── Push to Anki ──────────────────────────────────────────────────────────
  const handlePushToAnki = useCallback(async () => {
    if (!minedData || isPushing) return;

    setIsPushing(true);

    try {
      const results = await pushCardsToAnki({
        minedData,
        videoId,
        timestamp: mineTimestamp,
        deckName,
        modelName: sentenceModelName,
        vocabModelName,
      });

      const successCount = results.filter((r) => r !== null).length;
      showToast(
        `Pushed ${successCount}/${results.length} cards to Anki!`,
        'success'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed';
      showToast(msg, 'error');
    } finally {
      setIsPushing(false);
    }
  }, [
    minedData,
    isPushing,
    videoId,
    mineTimestamp,
    deckName,
    sentenceModelName,
    vocabModelName,
    showToast,
  ]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      {/* Global Header */}
      <Header
        videoUrl={videoUrl}
        onVideoUrlChange={setVideoUrl}
        onLoadVideo={handleLoadVideo}
      />

      {/* Main two-column layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── Left Column (65%) ── */}
        <div
          className="flex min-h-0 flex-col overflow-hidden border-r border-gray-700/50"
          style={{ width: '65%' }}
        >
          {/* Video Player */}
          <div className="shrink-0">
            {videoId ? (
              <VideoPlayer videoId={videoId} onPlayerReady={handlePlayerReady} />
            ) : (
              <div
                className="w-full bg-[#111318] flex flex-col items-center justify-center text-gray-600 gap-3"
                style={{ aspectRatio: '16/9' }}
              >
                <div className="text-5xl">🎌</div>
                <p className="text-sm">Paste a YouTube URL above to begin</p>
              </div>
            )}
          </div>

          {/* Playback Controls */}
          <PlaybackControls
            player={playerRef.current}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onSeekRelative={handleSeekRelative}
            onMineLine={() => handleMineLine()}
            isMining={isMining}
          />

          {/* Subtitle area header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50 bg-[#1e2129]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Subtitles
              </span>
              {subtitles.length > 0 && (
                <span className="text-xs text-gray-600">
                  ({subtitles.length} lines)
                </span>
              )}
              {captionStatus && (
                <span className="text-xs text-gray-500">{captionStatus}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={aiProvider}
                onChange={(event) => setAiProvider(event.target.value)}
                aria-label="AI provider"
                className="rounded-lg bg-gray-700 px-2 py-1.5 text-xs text-gray-200 outline-none ring-1 ring-gray-600 focus:ring-[#fca311]"
              >
                <option value="ollama">Ollama (local)</option>
                <option value="huggingface">Hugging Face</option>
                <option value="groq">Groq</option>
                <option value="deepseek">DeepSeek</option>
              </select>
              <SubtitleImport onImport={handleImportSubtitles} />
            </div>
          </div>

          {/* Subtitle Panel */}
          <div className="flex-1 overflow-hidden p-2">
            <SubtitlePanel
              subtitles={subtitles}
              activeIndex={activeIndex}
              onLineClick={handleSubtitleClick}
              onMineLine={handleMineLine}
            />
          </div>

          {/* Error display */}
          {mineError && (
            <div className="px-4 py-2 bg-red-950/50 border-t border-red-800 text-red-300 text-xs">
              ⚠ Mining error: {mineError}
            </div>
          )}
        </div>

        {/* ── Right Column (35%) ── */}
        <div className="flex min-h-0 flex-col overflow-hidden" style={{ width: '35%' }}>
          <MiningPreview
            minedData={minedData}
            videoId={videoId}
            timestamp={mineTimestamp}
            videoStartTimestamp={mineStartTimestamp}
            videoEndTimestamp={mineEndTimestamp}
            deckName={deckName}
            vocabModelName={vocabModelName}
            sentenceModelName={sentenceModelName}
            availableDecks={availableDecks}
            availableModels={availableModels}
            ankiConnected={ankiConnected}
            isPushing={isPushing}
            onDeckChange={setDeckName}
            onSentenceModelChange={setSentenceModelName}
            onVocabModelChange={setVocabModelName}
            onMinedDataChange={setMinedData}
            onPushToAnki={handlePushToAnki}
            onCardsSaved={handleCardsSaved}
          />
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-2xl text-sm font-medium z-50 transition-all ${
            toast.type === 'success'
              ? 'bg-green-900 border border-green-700 text-green-200'
              : 'bg-red-900 border border-red-700 text-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
