'use client';

import React from 'react';
import type { MinedData, VocabCard } from '@/lib/types';
import SaveStudyCardsButton from '@/components/SaveStudyCardsButton';

interface MiningPreviewProps {
  minedData: MinedData | null;
  videoId: string;
  timestamp: number;
  videoStartTimestamp: number;
  videoEndTimestamp: number;
  deckName: string;
  vocabModelName: string;
  sentenceModelName: string;
  availableDecks: string[];
  availableModels: string[];
  ankiConnected: boolean;
  isPushing: boolean;
  onDeckChange: (deck: string) => void;
  onSentenceModelChange: (model: string) => void;
  onVocabModelChange: (model: string) => void;
  onMinedDataChange: (data: MinedData) => void;
  onPushToAnki: () => void;
  onCardsSaved: (count: number) => void;
}

function VocabCardEditor({
  card,
  index,
  onChange,
}: {
  card: VocabCard;
  index: number;
  onChange: (updated: VocabCard) => void;
}) {
  const inputClass =
    'w-full px-2 py-1.5 rounded bg-[#1a1d24] border border-gray-600 text-sm text-gray-100 focus:outline-none focus:border-[#fca311] transition-colors';

  return (
    <div className="p-3 rounded-lg bg-[#1a1d24] border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#fca311] uppercase tracking-wider">
          Vocab #{index + 1}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Word</label>
          <input
            className={inputClass}
            value={card.word}
            onChange={(e) => onChange({ ...card, word: e.target.value })}
            placeholder="単語"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Reading</label>
          <input
            className={inputClass}
            value={card.reading}
            onChange={(e) => onChange({ ...card, reading: e.target.value })}
            placeholder="たんご"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Meaning</label>
          <input
            className={inputClass}
            value={card.meaning}
            onChange={(e) => onChange({ ...card, meaning: e.target.value })}
            placeholder="vocabulary word"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Breakdown</label>
          <input
            className={inputClass}
            value={card.breakdown}
            onChange={(e) => onChange({ ...card, breakdown: e.target.value })}
            placeholder="単 = たん | 語 = ご"
          />
        </div>
      </div>
    </div>
  );
}

export default function MiningPreview({
  minedData,
  videoId,
  timestamp,
  videoStartTimestamp,
  videoEndTimestamp,
  deckName,
  vocabModelName,
  sentenceModelName,
  availableDecks,
  availableModels,
  ankiConnected,
  isPushing,
  onDeckChange,
  onSentenceModelChange,
  onVocabModelChange,
  onMinedDataChange,
  onPushToAnki,
  onCardsSaved,
}: MiningPreviewProps) {
  const selectClass =
    'w-full px-2 py-1.5 rounded bg-[#1a1d24] border border-gray-600 text-sm text-gray-100 focus:outline-none focus:border-[#fca311] transition-colors';

  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : null;

  const sourceLink = videoId
    ? `https://youtu.be/${videoId}?t=${Math.floor(timestamp)}`
    : null;

  const handleCardChange = (index: number, updated: VocabCard) => {
    if (!minedData) return;
    const newCards = [...minedData.cards];
    newCards[index] = updated;
    onMinedDataChange({ ...minedData, cards: newCards });
  };

  return (
    <div className="flex flex-col h-full bg-[#222732] border-l border-gray-700/50">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
        <h2 className="font-semibold text-sm text-gray-200">Mining Preview</h2>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              ankiConnected ? 'bg-green-400' : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-gray-400">
            Anki {ankiConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Anki Settings */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Anki Settings
          </h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Deck</label>
            <select
              className={selectClass}
              value={deckName}
              onChange={(e) => onDeckChange(e.target.value)}
            >
              {availableDecks.length === 0 ? (
                <option value="">— not connected —</option>
              ) : (
                availableDecks.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Sentence Note Type
              </label>
              <select
                className={selectClass}
                value={sentenceModelName}
                onChange={(e) => onSentenceModelChange(e.target.value)}
              >
                {availableModels.length === 0 ? (
                  <option value="">— not connected —</option>
                ) : (
                  availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Vocab Note Type
              </label>
              <select
                className={selectClass}
                value={vocabModelName}
                onChange={(e) => onVocabModelChange(e.target.value)}
              >
                {availableModels.length === 0 ? (
                  <option value="">— not connected —</option>
                ) : (
                  availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {!minedData && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-600 text-sm gap-2">
            <div className="text-4xl">⛏</div>
            <p className="text-center">
              Click &ldquo;Mine Line&rdquo; or press{' '}
              <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400 text-xs">
                M
              </kbd>{' '}
              to mine a subtitle line.
            </p>
          </div>
        )}

        {/* Sentence Card Preview */}
        {minedData && (
          <>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Sentence Card
              </h3>
              <div className="rounded-lg border border-gray-700 overflow-hidden">
                {/* Thumbnail */}
                {thumbnailUrl && (
                  <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnailUrl}
                      alt="Video thumbnail"
                      className="w-full h-full object-cover opacity-80"
                    />
                    {sourceLink && (
                      <a
                        href={sourceLink}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-[#fca311] text-xs rounded hover:bg-black/90 transition-colors"
                      >
                        ▶ {Math.floor(timestamp)}s
                      </a>
                    )}
                  </div>
                )}

                {/* Card fields */}
                <div className="p-3 space-y-2 bg-[#1a1d24]">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      JP Sentence
                    </label>
                    <textarea
                      className="w-full px-2 py-1.5 rounded bg-[#222732] border border-gray-600 text-sm text-gray-100 focus:outline-none focus:border-[#fca311] transition-colors resize-none"
                      rows={2}
                      value={minedData.sentence_jp}
                      onChange={(e) =>
                        onMinedDataChange({
                          ...minedData,
                          sentence_jp: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Reading
                    </label>
                    <input
                      className="w-full px-2 py-1.5 rounded bg-[#222732] border border-gray-600 text-sm text-gray-100 focus:outline-none focus:border-[#fca311] transition-colors"
                      value={minedData.sentence_reading}
                      onChange={(e) =>
                        onMinedDataChange({
                          ...minedData,
                          sentence_reading: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      EN Translation
                    </label>
                    <textarea
                      className="w-full px-2 py-1.5 rounded bg-[#222732] border border-gray-600 text-sm text-gray-100 focus:outline-none focus:border-[#fca311] transition-colors resize-none"
                      rows={2}
                      value={minedData.sentence_en}
                      onChange={(e) =>
                        onMinedDataChange({
                          ...minedData,
                          sentence_en: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Vocabulary Cards */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Vocabulary Cards ({minedData.cards.length})
              </h3>
              <div className="space-y-2">
                {minedData.cards.map((card, i) => (
                  <VocabCardEditor
                    key={i}
                    card={card}
                    index={i}
                    onChange={(updated) => handleCardChange(i, updated)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Push to Anki Button */}
      <div className="space-y-2 px-4 py-3 border-t border-gray-700/50">
        <SaveStudyCardsButton
          minedData={minedData}
          videoId={videoId}
          timestamp={timestamp}
          videoStartTimestamp={videoStartTimestamp}
          videoEndTimestamp={videoEndTimestamp}
          onSaved={onCardsSaved}
        />
        <button
          onClick={onPushToAnki}
          disabled={!minedData || !ankiConnected || isPushing}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
            !minedData || !ankiConnected || isPushing
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-[#fca311] hover:bg-amber-400 active:bg-amber-600 text-black'
          }`}
        >
          {isPushing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Pushing to Anki…
            </span>
          ) : !ankiConnected ? (
            '🔌 Anki Not Connected'
          ) : (
            `📤 Push to Anki (${minedData ? minedData.cards.length + 1 : 0} cards)`
          )}
        </button>

        {!ankiConnected && (
          <p className="text-xs text-gray-500 text-center mt-2">
            Start Anki with AnkiConnect add-on to enable push.
          </p>
        )}
      </div>
    </div>
  );
}
