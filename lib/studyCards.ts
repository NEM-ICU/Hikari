import {
  createEmptyCard,
  type Card,
  type CardInput,
} from 'ts-fsrs';
import type { MinedData } from '@/lib/types';

export type StudyCardType = 'sentence' | 'vocabulary';

export interface StudyCard {
  id: string;
  user_id: string;
  card_type: StudyCardType;
  front: string;
  back: string;
  reading: string | null;
  meaning: string | null;
  breakdown: string | null;
  sentence_reading: string | null;
  sentence_translation: string | null;
  source_sentence: string | null;
  source_video_id: string | null;
  source_timestamp: number | null;
  source_end_timestamp: number | null;
  fsrs_state: Record<string, unknown>;
  due_at: string;
  created_at: string;
  updated_at: string;
}

export type SerializedFsrsCard = Omit<Card, 'due' | 'last_review'> & {
  due: string;
  last_review?: string | null;
};

export function serializeFsrsCard(card: Card): SerializedFsrsCard {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString() ?? null,
  };
}

export function deserializeFsrsCard(value: Record<string, unknown>): CardInput {
  const due = typeof value.due === 'string' ? value.due : new Date().toISOString();
  const lastReview = typeof value.last_review === 'string' ? value.last_review : null;
  return {
    ...value,
    due,
    last_review: lastReview,
  } as CardInput;
}

export function initialFsrsState(now = new Date()): SerializedFsrsCard {
  return serializeFsrsCard(createEmptyCard(now));
}

export function buildStudyCardRows(
  data: MinedData,
  videoId: string,
  timestamp: number,
  userId: string,
  now = new Date(),
  videoStartTimestamp = timestamp,
  videoEndTimestamp = timestamp
) {
  const sourceTimestamp = Math.max(0, videoStartTimestamp);
  const sourceEndTimestamp = Math.max(sourceTimestamp, videoEndTimestamp);
  const dueAt = now.toISOString();
  const fsrsState = initialFsrsState(now);
  const shared = {
    user_id: userId,
    source_video_id: videoId || null,
    source_timestamp: videoId ? sourceTimestamp : null,
    source_end_timestamp: videoId ? sourceEndTimestamp : null,
    source_sentence: data.sentence_jp,
    sentence_reading: data.sentence_reading,
    sentence_translation: data.sentence_en,
    fsrs_state: fsrsState,
    due_at: dueAt,
  };

  return [
    {
      ...shared,
      card_type: 'sentence' as const,
      front: data.sentence_jp,
      back: data.sentence_en,
      reading: data.sentence_reading,
      meaning: null,
      breakdown: null,
    },
    ...data.cards
      .filter((card) => card.word.trim())
      .map((card) => ({
        ...shared,
        card_type: 'vocabulary' as const,
        front: card.word,
        back: card.meaning,
        reading: card.reading,
        meaning: card.meaning,
        breakdown: card.breakdown,
      })),
  ];
}
