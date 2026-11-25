import { NextRequest, NextResponse } from 'next/server';

interface CaptionTrack {
  trackName: string;
  langCode: string;
  kind?: string;
  vssId: string;
  baseUrl: string;
}

type PlayerResponse = Record<string, unknown>;

function extractPlayerResponse(html: string): Record<string, unknown> | null {
  const marker = 'ytInitialPlayerResponse =';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf('{', markerIndex + marker.length);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function tracksFromPlayerResponse(response: PlayerResponse | null): CaptionTrack[] {
  const captions = response?.captions as
    | { playerCaptionsTracklistRenderer?: { captionTracks?: Array<Record<string, unknown>> } }
    | undefined;
  const rawTracks = captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  return rawTracks.flatMap((track) => {
    if (typeof track.baseUrl !== 'string' || typeof track.languageCode !== 'string') return [];
    const name = track.name as { simpleText?: string } | undefined;
    return [{
      trackName: name?.simpleText ?? '',
      langCode: track.languageCode,
      kind: typeof track.kind === 'string' ? track.kind : undefined,
      vssId: typeof track.vssId === 'string' ? track.vssId : '',
      baseUrl: track.baseUrl,
    }];
  });
}

async function fetchAndroidPlayerResponse(videoId: string, apiKey: string): Promise<PlayerResponse | null> {
  const response = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': '20.10.38',
      },
      body: JSON.stringify({
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '20.10.38',
            androidSdkVersion: 30,
            hl: 'ja',
            gl: 'JP',
          },
        },
      }),
    }
  );
  if (!response.ok) return null;
  return response.json() as Promise<PlayerResponse>;
}

/** Read caption tracks embedded in YouTube's own watch-page player response. */
async function fetchTrackList(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoMine/1.0)' },
  });
  if (!res.ok) throw new Error(`YouTube video page returned HTTP ${res.status}`);
  const page = await res.text();
  const apiKey = page.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  if (apiKey) {
    const androidTracks = tracksFromPlayerResponse(
      await fetchAndroidPlayerResponse(videoId, apiKey)
    );
    if (androidTracks.length > 0) return androidTracks;
  }

  const embeddedTracks = tracksFromPlayerResponse(extractPlayerResponse(page));
  if (embeddedTracks.length > 0) return embeddedTracks;

  // Some videos still expose their tracks through the legacy timedtext list.
  const legacy = await fetch(
    `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`,
    { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (!legacy.ok) return [];
  const xml = await legacy.text();
  const tracks: CaptionTrack[] = [];
  for (const match of xml.matchAll(/<track\b[^>]*>/g)) {
    const tag = match[0];
    const attr = (key: string) => tag.match(new RegExp(`\\b${key}="([^"]*)"`))?.[1] ?? '';
    const langCode = attr('lang_code');
    if (!langCode) continue;
    const params = new URLSearchParams({ type: 'track', v: videoId, lang: langCode });
    const trackName = attr('name');
    if (trackName) params.set('name', trackName);
    tracks.push({
      trackName,
      langCode,
      kind: attr('kind') || undefined,
      vssId: attr('vssId'),
      baseUrl: `https://www.youtube.com/api/timedtext?${params.toString()}`,
    });
  }
  return tracks;
}

function secondsToVtt(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1_000);
  const ms = totalMs % 1_000;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(x[\da-fA-F]+|\d+);/g, (_, code) =>
      String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : parseInt(code, 10))
    );
}

function timedTextXmlToVtt(xml: string): string {
  const cues: string[] = [];
  for (const match of xml.matchAll(/<(?:text|p)\b([^>]*)>([\s\S]*?)<\/(?:text|p)>/g)) {
    const attributes = match[1];
    const startValue = attributes.match(/\b(?:start|t)="([^"]+)"/)?.[1];
    const durationValue = attributes.match(/\bdur="([^"]+)"/)?.[1];
    // SRV3 uses millisecond `t` / `d` values; the older XML format uses seconds.
    const start = Number(startValue);
    const duration = Number(durationValue ?? 2);
    const caption = decodeHtml(match[2]).trim();
    if (Number.isFinite(start) && caption) {
      const useMilliseconds = /\bt="/.test(attributes);
      const startSeconds = useMilliseconds ? start / 1_000 : start;
      const durationSeconds = useMilliseconds ? duration / 1_000 : duration;
      cues.push(`${secondsToVtt(startSeconds)} --> ${secondsToVtt(startSeconds + durationSeconds)}\n${caption}`);
    }
  }
  return cues.length ? `WEBVTT\n\n${cues.join('\n\n')}\n` : '';
}

function json3ToVtt(text: string): string {
  try {
    const payload = JSON.parse(text) as {
      events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }>;
    };
    const cues = (payload.events ?? []).flatMap((event) => {
      const start = event.tStartMs;
      const caption = (event.segs ?? []).map((segment) => segment.utf8 ?? '').join('').trim();
      if (typeof start !== 'number' || !caption) return [];
      const duration = typeof event.dDurationMs === 'number' ? event.dDurationMs : 2_000;
      return [`${secondsToVtt(start / 1_000)} --> ${secondsToVtt((start + duration) / 1_000)}\n${caption}`];
    });
    return cues.length ? `WEBVTT\n\n${cues.join('\n\n')}\n` : '';
  } catch {
    return '';
  }
}

function toVtt(text: string): string {
  if (text.startsWith('WEBVTT')) return text;
  if (text.trimStart().startsWith('{')) return json3ToVtt(text);
  return timedTextXmlToVtt(text);
}

/** Fetch a track in the format YouTube actually returns, then normalize it to VTT. */
async function fetchCaptionVtt(track: CaptionTrack): Promise<string> {
  const formats = [undefined, 'vtt', 'json3', 'srv3'];
  for (const format of formats) {
    const url = new URL(track.baseUrl);
    if (format) url.searchParams.set('fmt', format);
    else url.searchParams.delete('fmt');
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        Referer: 'https://www.youtube.com/',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
      },
    });
    if (!res.ok) continue;
    const vtt = toVtt(await res.text());
    if (vtt) return vtt;
  }
  throw new Error(`YouTube returned an empty ${track.kind === 'asr' ? 'auto-generated ' : ''}caption track.`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  const lang = searchParams.get('lang'); // optional: pick a specific track
  const listOnly = searchParams.get('list') === '1';

  if (!videoId) {
    return NextResponse.json(
      { error: 'videoId query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const tracks = await fetchTrackList(videoId);

    if (tracks.length === 0) {
      return NextResponse.json(
        {
          error:
            'No caption tracks found for this video. The video may not have subtitles, or they may be embedded only.',
          tracks: [],
        },
        { status: 404 }
      );
    }

    if (listOnly) {
      return NextResponse.json({ tracks });
    }

    // Pick a track: explicit lang param, else prefer ja, else first non-asr, else first.
    let chosen = tracks.find((t) => t.langCode === lang);
    if (!chosen) {
      chosen =
        tracks.find((t) => t.langCode.startsWith('ja')) ??
        tracks.find((t) => t.kind !== 'asr') ??
        tracks[0];
    }

    const vtt = await fetchCaptionVtt(chosen);
    return NextResponse.json({
      format: 'vtt',
      langCode: chosen.langCode,
      trackName: chosen.trackName,
      vtt,
      tracks,
    });
  } catch (error) {
    console.error('Subtitles API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
