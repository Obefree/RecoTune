/**
 * Heuristic: attach ChordPro-style [chord] markers using the song's progression string.
 * Not musically authoritative — only so UI can render chords above lines when the DB
 * has plain text or no lyrics at all.
 */

const CHORD_IN_LINE = /\[[A-Ga-g][^\]]*]/;

export function lyricsHaveChordMarkers(lyrics: string | undefined): boolean {
  return !!lyrics && CHORD_IN_LINE.test(lyrics);
}

/** progression: "Am F C G" etc. */
export function inferChordProFromProgression(
  plainLyrics: string,
  chords: string,
  title: string,
): string {
  const cells = chords
    .trim()
    .split(/[\s,|/]+/)
    .map(c => c.trim())
    .filter(Boolean);
  if (cells.length === 0) {
    return plainLyrics.trim() ? plainLyrics : `[N.C.]${title}`;
  }
  /* No lyrics: one chord per line (readable order), then title — not one crowded row of pills. */
  if (!plainLyrics.trim()) {
    return `${cells.map(c => `[${c}]`).join('\n')}\n\n— ${title} —`;
  }
  return plainLyrics
    .split('\n')
    .map((ln, i) => {
      if (!ln.trim()) return ln;
      if (CHORD_IN_LINE.test(ln)) return ln;
      const c = cells[i % cells.length]!;
      return `[${c}]${ln}`;
    })
    .join('\n');
}

export function mergeSongLyricsWithProgression(
  song: { id: string; title: string; chords: string; lyrics?: string },
  lyricsDb: Record<string, string>,
): string | undefined {
  let lyr = lyricsDb[song.id] ?? song.lyrics;
  if (lyricsHaveChordMarkers(lyr)) return lyr;
  if (!song.chords?.trim()) return lyr?.trim() ? lyr : undefined;
  const plain = (lyr ?? '').trim();
  /* No stored text: do not inject placeholder here — pickSong will fetch lyrics.ovh; offline fallback uses inferChordProFromProgression('', …). */
  if (!plain) return undefined;
  return inferChordProFromProgression(plain, song.chords, song.title);
}
