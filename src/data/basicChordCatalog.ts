/**
 * Ordered reference groups: major / minor / dom7 / maj7 / min7 per chromatic step.
 * Spelling matches keys in chordShapes TABLES (ASCII: C#, Db, …).
 */
import { getChordShape } from './chordShapes';

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/** Unicode for section headings */
const SHARP_LBL = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const FLAT_LBL = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

export type BasicCatalogEntry = {
  name: string;
  label: string;
};

export type BasicCatalogSection = {
  title: string;
  entries: BasicCatalogEntry[];
};

function firstAvailable(diagramId: string, candidates: string[]): string | null {
  for (const c of candidates) {
    if (getChordShape(diagramId, c)) return c;
  }
  return null;
}

function pushUnique(out: BasicCatalogEntry[], name: string | null, label: string) {
  if (!name) return;
  if (out.some(e => e.name === name)) return;
  out.push({ name, label });
}

/**
 * Build sections for the selected instrument (diagram id).
 * Only chords that exist in that instrument's table are listed.
 */
export function getBasicChordCatalog(diagramId: string): BasicCatalogSection[] {
  const sections: BasicCatalogSection[] = [];

  for (let i = 0; i < 12; i++) {
    const sr = SHARP_NAMES[i];
    const fr = FLAT_NAMES[i];
    const title = sr === fr ? SHARP_LBL[i] : `${SHARP_LBL[i]} / ${FLAT_LBL[i]}`;
    const entries: BasicCatalogEntry[] = [];

    const major = firstAvailable(diagramId, [sr, fr]);
    pushUnique(entries, major, 'маж.');

    const minor = firstAvailable(diagramId, [`${sr}m`, `${fr}m`]);
    pushUnique(entries, minor, 'мин.');

    const dom7 = firstAvailable(diagramId, [`${sr}7`, `${fr}7`]);
    pushUnique(entries, dom7, '7');

    const maj7 = firstAvailable(diagramId, [`${sr}maj7`, `${fr}maj7`]);
    pushUnique(entries, maj7, 'maj7');

    const min7 = firstAvailable(diagramId, [`${sr}m7`, `${fr}m7`]);
    pushUnique(entries, min7, 'm7');

    if (entries.length > 0) {
      sections.push({ title, entries });
    }
  }

  return sections;
}
