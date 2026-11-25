import type { SubtitleLine } from './types';

/**
 * Parses WebVTT subtitle format into SubtitleLine array.
 * Handles multi-line cue text, timestamps like 00:00:01.000 --> 00:00:03.500
 */
export function parseVTT(vttText: string): SubtitleLine[] {
  const lines = vttText.split('\n');
  const subtitles: SubtitleLine[] = [];
  let index = 0;
  let i = 0;

  // Skip WEBVTT header
  while (i < lines.length && !lines[i].trim().includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip numeric cue identifiers
    if (/^\d+$/.test(line)) {
      i++;
      continue;
    }

    // Look for timestamp line
    const timestampMatch = line.match(
      /(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})/
    );

    if (timestampMatch) {
      const startTime = parseTimestamp(line.split('-->')[0].trim());
      const endTime = parseTimestamp(line.split('-->')[1].trim());

      i++;
      const textLines: string[] = [];

      while (i < lines.length && lines[i].trim() !== '') {
        // Strip VTT tags like <c>, <ruby>, etc.
        const cleanLine = lines[i].replace(/<[^>]+>/g, '').trim();
        if (cleanLine) textLines.push(cleanLine);
        i++;
      }

      const text = textLines.join(' ').trim();
      if (text) {
        subtitles.push({ index, startTime, endTime, text });
        index++;
      }
    }

    i++;
  }

  return subtitles;
}

/**
 * Parses SRT subtitle format into SubtitleLine array.
 */
export function parseSRT(srtText: string): SubtitleLine[] {
  const blocks = srtText.trim().split(/\n\s*\n/);
  const subtitles: SubtitleLine[] = [];

  blocks.forEach((block, idx) => {
    const lines = block.trim().split('\n');
    if (lines.length < 2) return;

    // Find the timestamp line
    const tsLine = lines.find((l) => l.includes('-->'));
    if (!tsLine) return;

    const startTime = parseTimestamp(tsLine.split('-->')[0].trim());
    const endTime = parseTimestamp(tsLine.split('-->')[1].trim());

    const textStart = lines.indexOf(tsLine) + 1;
    const text = lines
      .slice(textStart)
      .map((l) => l.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
      .join(' ');

    if (text) {
      subtitles.push({ index: idx, startTime, endTime, text });
    }
  });

  return subtitles;
}

/**
 * Converts a timestamp string (HH:MM:SS.mmm or MM:SS.mmm) to seconds.
 */
function parseTimestamp(ts: string): number {
  // Remove any position/align cue settings after a space
  const clean = ts.split(' ')[0].replace(',', '.');
  const parts = clean.split(':').map(Number);

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Finds the active subtitle index for a given current time.
 */
export function findActiveSubtitle(
  subtitles: SubtitleLine[],
  currentTime: number
): number {
  // Binary search for performance
  let lo = 0;
  let hi = subtitles.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const sub = subtitles[mid];

    if (currentTime >= sub.startTime && currentTime <= sub.endTime) {
      return mid;
    } else if (currentTime < sub.startTime) {
      hi = mid - 1;
    } else {
      result = mid; // last seen before current time
      lo = mid + 1;
    }
  }

  return result;
}

/**
 * Extracts YouTube video ID from various URL formats.
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // bare video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
