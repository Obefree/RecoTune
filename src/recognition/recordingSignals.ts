import type { RecognitionSignals } from './types';

/** «Artist - Title.ext» or «Artist – Title» from last path segment. */
export function parseArtistTitleFromFilename(name: string): { artist: string; title: string } | null {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').trim();
  if (!base) return null;
  const sep = base.match(/\s+[-–—]\s+/);
  if (!sep || sep.index == null || sep.index < 1) return null;
  const artist = base.slice(0, sep.index).trim();
  const title = base.slice(sep.index + sep[0].length).trim();
  if (!artist || !title || artist.length < 2 || title.length < 2) return null;
  return { artist, title };
}

/** Real metadata from file URI / duration — no fake BPM/chroma. */
export async function extractSignalsFromRecording(
  uri: string,
  options: { durationSec: number; source: 'mic' | 'file' },
): Promise<RecognitionSignals> {
  const signals: RecognitionSignals = {};
  void uri;
  void options.durationSec;

  if (options.source === 'file') {
    const segment = decodeURIComponent(uri.split('/').pop() ?? '');
    const parsed = parseArtistTitleFromFilename(segment);
    if (parsed) {
      signals.artist = parsed.artist;
      signals.title = parsed.title;
      signals.textQuery = `${parsed.artist} ${parsed.title}`.trim();
    }
  }

  return signals;
}
