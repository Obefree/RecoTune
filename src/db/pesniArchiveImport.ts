/**
 * Offline tabs now live in assets/catalog (index + lyric shards).
 * Do not require pesni-chordpro.json / proxy-parsed-chords.json here —
 * those monoliths freeze the Chords tab on parse.
 */
import { getOfflineCatalogTabCount } from '../catalog/offlineCatalog';

export function getPesniOfflineTabCount(): number {
  return getOfflineCatalogTabCount();
}

/** @deprecated use getOfflineCatalogTabCount — kept as a number for old hint strings. */
export const PESNI_OFFLINE_TAB_COUNT = 0;

/** Catalog is the index JSON; SQLite no longer bulk-imports lyrics. */
export async function importPesniChordProArchive(): Promise<{ imported: number }> {
  return { imported: 0 };
}
