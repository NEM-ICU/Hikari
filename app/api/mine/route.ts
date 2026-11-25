import { NextRequest, NextResponse } from 'next/server';
import type { MineRequest, MinedData } from '@/lib/types';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
type AiProvider = 'ollama' | 'huggingface' | 'deepseek' | 'groq';

const SYSTEM_PROMPT = `You are a Japanese language tutor helping a student mine vocabulary cards for Anki from Japanese YouTube subtitles. Analyze the target sentence and its context. For every request, return strict JSON containing:
- sentence_jp: the exact target sentence in Japanese
- sentence_reading: the sentence in hiragana with spaces between words  
- sentence_en: a natural, fluent English translation
- cards: an array of 3-6 key vocabulary items from the sentence

Each card in the cards array must have:
- word: the word in dictionary form (辞書形)
- reading: the word's reading in hiragana
- meaning: a concise English meaning
- breakdown: kanji component analysis like '言 = い (say) | う = (speak)' or '食べる = た (eat)'

Focus on content words: nouns, verbs, adjectives, adverbs. Skip common particles and copulas unless pedagogically interesting.`;

const responseSchema = {
  type: 'object',
  properties: {
    sentence_jp: { type: 'string', description: 'Exact Japanese sentence' },
    sentence_reading: {
      type: 'string',
      description: 'Hiragana reading with spaces between words',
    },
    sentence_en: { type: 'string', description: 'Natural English translation' },
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string', description: 'Dictionary form of the word' },
          reading: { type: 'string', description: 'Hiragana reading' },
          meaning: { type: 'string', description: 'Concise English meaning' },
          breakdown: {
            type: 'string',
            description: 'Kanji component analysis',
          },
        },
        required: ['word', 'reading', 'meaning', 'breakdown'],
      },
    },
  },
  required: ['sentence_jp', 'sentence_reading', 'sentence_en', 'cards'],
};

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function formatProviderError(status: number, bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as { error?: string | { message?: string } };
    if (typeof parsed.error === 'string') return `${status}: ${parsed.error}`;
    if (parsed.error?.message) return `${status}: ${parsed.error.message}`;
  } catch {
    // Fall back to raw text
  }
  return `${status}: ${bodyText}`;
}

async function requestOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string,
  useResponseFormat = true
): Promise<string> {
  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    stream: false,
  };
  if (useResponseFormat) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errText = await response.text();
    if (useResponseFormat && (response.status === 400 || response.status === 422) && /response_format/i.test(errText)) {
      return requestOpenAICompatible(endpoint, apiKey, model, prompt, false);
    }
    throw new Error(formatProviderError(response.status, errText));
  }
  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error('The AI provider returned no response');
  return text;
}

async function mineWithProvider(provider: AiProvider, prompt: string): Promise<string> {
  if (provider === 'ollama') {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system: SYSTEM_PROMPT,
        prompt,
        format: responseSchema,
        stream: false,
        options: { temperature: 0.3 },
      }),
    });
    if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
    const result = (await response.json()) as { response?: string };
    if (!result.response) throw new Error('Ollama returned no response');
    return result.response;
  }

  if (provider === 'huggingface') {
    if (!process.env.HF_TOKEN) throw new Error('Set HF_TOKEN in .env.local to use Hugging Face');
    return requestOpenAICompatible(
      'https://router.huggingface.co/v1/chat/completions',
      process.env.HF_TOKEN,
      process.env.HUGGINGFACE_MODEL || 'openai/gpt-oss-120b:groq',
      prompt
    );
  }

  if (provider === 'deepseek') {
    if (!process.env.DEEPSEEK_API_KEY) throw new Error('Set DEEPSEEK_API_KEY in .env.local to use DeepSeek');
    return requestOpenAICompatible(
      'https://api.deepseek.com/chat/completions',
      process.env.DEEPSEEK_API_KEY,
      process.env.DEEPSEEK_MODEL || 'deepseek-flash',
      prompt
    );
  }

  if (!process.env.GROQ_API_KEY) throw new Error('Set GROQ_API_KEY in .env.local to use Groq');
  return requestOpenAICompatible(
    'https://api.groq.com/openai/v1/chat/completions',
    process.env.GROQ_API_KEY,
    process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    prompt
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MineRequest & { provider?: AiProvider };
    const { targetSentence, contextBefore, contextAfter, videoId, timestamp } =
      body;

    if (!targetSentence) {
      return NextResponse.json(
        { error: 'targetSentence is required' },
        { status: 400 }
      );
    }

    const userPrompt = `
Video ID: ${videoId}
Timestamp: ${Math.floor(timestamp)}s (https://youtu.be/${videoId}?t=${Math.floor(timestamp)})

Context before: ${contextBefore || '(none)'}
TARGET SENTENCE: ${targetSentence}
Context after: ${contextAfter || '(none)'}

Please analyze the target sentence and extract vocabulary cards for Anki.
`.trim();

    const provider: AiProvider = ['ollama', 'huggingface', 'deepseek', 'groq'].includes(body.provider ?? '')
      ? body.provider as AiProvider
      : 'ollama';
    const text = await mineWithProvider(provider, userPrompt);
    if (!text) {
      return NextResponse.json(
        { error: `${provider} returned no response` },
        { status: 500 }
      );
    }

    const minedData: MinedData = JSON.parse(extractJson(text));
    return NextResponse.json(minedData);
  } catch (error) {
    console.error('Mine API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
