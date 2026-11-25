// Core type definitions for KotoMine

export interface SubtitleLine {
  index: number;
  startTime: number; // seconds
  endTime: number;   // seconds
  text: string;
}

export interface VocabCard {
  word: string;
  reading: string;
  meaning: string;
  breakdown: string;
}

export interface MinedData {
  sentence_jp: string;
  sentence_reading: string;
  sentence_en: string;
  cards: VocabCard[];
}

export interface MineRequest {
  targetSentence: string;
  contextBefore: string;
  contextAfter: string;
  videoId: string;
  timestamp: number;
}

export interface AnkiConnectRequest {
  action: string;
  version: number;
  params?: Record<string, unknown>;
}

export interface AnkiConnectResponse<T = unknown> {
  result: T;
  error: string | null;
}

export interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  options: {
    allowDuplicate: boolean;
    duplicateScope: string;
  };
  tags: string[];
}

export interface PushToAnkiParams {
  minedData: MinedData;
  videoId: string;
  timestamp: number;
  deckName: string;
  modelName: string;
  vocabModelName: string;
}
