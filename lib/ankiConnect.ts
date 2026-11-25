import type { AnkiConnectRequest, AnkiConnectResponse, AnkiNote, PushToAnkiParams } from './types';

const ANKI_CONNECT_PORT = process.env.NEXT_PUBLIC_ANKI_CONNECT_PORT || '8765';
const ANKI_CONNECT_HOST = process.env.NEXT_PUBLIC_ANKI_CONNECT_HOST || '127.0.0.1';
const ANKI_CONNECT_URL = `http://${ANKI_CONNECT_HOST}:${ANKI_CONNECT_PORT}`;

async function ankiRequest<T>(action: string, params?: Record<string, unknown>): Promise<T> {
  const body: AnkiConnectRequest = { action, version: 6, ...(params ? { params } : {}) };

  const response = await fetch(ANKI_CONNECT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`AnkiConnect HTTP error: ${response.status}`);
  }

  const data: AnkiConnectResponse<T> = await response.json();

  if (data.error) {
    throw new Error(`AnkiConnect error: ${data.error}`);
  }

  return data.result;
}

export async function checkConnection(): Promise<boolean> {
  try {
    const version = await ankiRequest<number>('version');
    return version >= 6;
  } catch {
    return false;
  }
}

export async function getDecksAndModels(): Promise<{
  decks: string[];
  models: string[];
}> {
  const [decks, models] = await Promise.all([
    ankiRequest<string[]>('deckNames'),
    ankiRequest<string[]>('modelNames'),
  ]);
  return { decks, models };
}

async function getModelFields(modelName: string): Promise<string[]> {
  return ankiRequest<string[]>('modelFieldNames', { modelName });
}

export async function storeMediaFile(filename: string, url: string): Promise<string> {
  return ankiRequest<string>('storeMediaFile', { filename, url });
}

export async function pushCardsToAnki({
  minedData,
  videoId,
  timestamp,
  deckName,
  modelName,
  vocabModelName,
}: PushToAnkiParams): Promise<(number | null)[]> {
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const thumbnailFilename = `kotomine_${videoId}.jpg`;
  const sourceLink = `https://youtu.be/${videoId}?t=${Math.floor(timestamp)}`;

  // Store thumbnail in Anki media
  try {
    await storeMediaFile(thumbnailFilename, thumbnailUrl);
  } catch {
    // Non-fatal: proceed without image if storage fails
    console.warn('Could not store thumbnail in Anki media');
  }

  const sentenceFields = {
    JP_Sentence: minedData.sentence_jp,
    Reading: minedData.sentence_reading,
    EN_Translation: minedData.sentence_en,
    Sentence_Audio: '',
    Sentence_Image: `<img src="${thumbnailFilename}">`,
    Source_Link: `<a href="${sourceLink}">${sourceLink}</a>`,
  };

  const hasValue = (fields: Record<string, string>) =>
    Object.values(fields).some((value) => typeof value === 'string' && value.trim().length > 0);

  const sentenceNote: AnkiNote = {
    deckName,
    modelName,
    fields: sentenceFields,
    options: {
      allowDuplicate: false,
      duplicateScope: 'deck',
    },
    tags: ['kotomine', videoId],
  };

  const vocabNotes: AnkiNote[] = minedData.cards.map((card) => ({
    deckName,
    modelName: vocabModelName,
    fields: {
      Word: card.word,
      Reading: card.reading,
      Meaning: card.meaning,
      Breakdown: card.breakdown,
    },
    options: {
      allowDuplicate: false,
      duplicateScope: 'deck',
    },
    tags: ['kotomine', videoId, 'vocabulary'],
  }));

  // Anki considers a note empty when its model's first field is blank. Filter
  // incomplete records so a single bad generated card cannot reject the batch.
  const allNotes = [
    ...(minedData.sentence_jp?.trim() ? [sentenceNote] : []),
    ...vocabNotes.filter((note) => hasValue(note.fields) && note.fields.Word?.trim()),
  ];

  if (allNotes.length === 0) {
    throw new Error('No cards to push: the sentence and vocabulary cards are empty.');
  }

  // Anki decides whether a note is empty from the note type's first field.
  // Check actual model fields first so a wrong model selection gives a useful
  // error instead of AnkiConnect's repeated, generic empty-note message.
  const modelNames = [...new Set(allNotes.map((note) => note.modelName))];
  const fieldsByModel = new Map<string, string[]>();
  await Promise.all(modelNames.map(async (name) => {
    fieldsByModel.set(name, await getModelFields(name));
  }));

  for (const note of allNotes) {
    const modelFields = fieldsByModel.get(note.modelName) ?? [];
    if (modelFields.length === 0) {
      throw new Error(`The Anki note type “${note.modelName}” has no fields or could not be found.`);
    }

    const firstField = modelFields[0];
    const firstFieldValue = note.fields[firstField];
    if (typeof firstFieldValue !== 'string' || !firstFieldValue.trim()) {
      const expected = note.modelName === vocabModelName ? 'Word' : 'JP_Sentence';
      throw new Error(
        `The first field of “${note.modelName}” is “${firstField}”, but this card has no value for it. ` +
        `Choose/create the matching note type with “${expected}” as its first field.`
      );
    }
  }

  return ankiRequest<(number | null)[]>('addNotes', { notes: allNotes });
}
