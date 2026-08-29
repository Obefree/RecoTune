import { getProviderSettings } from '../providers/providerSettings';

import { getSchemaMeta, setSchemaMeta } from '../db/songLibrary';

import { getMetadataTrackCount } from './metadataDb';

import { upsertMetadataBatch } from './metadataDb';
import { formatMetadataSyncError, runMetadataImportExclusive } from './metadataSyncLock';

import type { MetadataBatchPayload, MetadataSyncProgress } from './types';

export { formatMetadataSyncError, isMetadataSyncRunning } from './metadataSyncLock';

import {

  getBundledMetadataChunks,

  METADATA_BUNDLED_TOTAL_HINT,

  METADATA_BUNDLED_VERSION,

} from './bundledChunks';



export type { MetadataSyncProgress } from './types';



const META_SYNC_CURSOR_KEY = 'metadata_sync_cursor';

const META_SYNC_DONE_KEY = 'metadata_bundled_seed_done';

const META_BUNDLED_VERSION_KEY = 'metadata_bundled_version';

const BATCH_SIZE = 500;

/** Delay between background chunk imports (keeps UI responsive). */
const BACKGROUND_BATCH_DELAY_MS = 280;



/** Target catalog size (KB D7). */

export const METADATA_CATALOG_TARGET = 5000;

export async function fetchMetadataBatchFromServer(

  baseUrl: string,

  offset: number,

  limit: number,

): Promise<MetadataBatchPayload> {

  const root = baseUrl.replace(/\/$/, '');

  const url = `${root}/metadata/batch?offset=${offset}&limit=${limit}`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  return (await res.json()) as MetadataBatchPayload;

}



function bundledBatchAt(index: number): MetadataBatchPayload | null {

  if (index < 0 || index >= getBundledMetadataChunks().length) return null;

  const chunk = getBundledMetadataChunks()[index];

  return {

    ...chunk,

    cursor: index,

    nextCursor: index + 1 < getBundledMetadataChunks().length ? index + 1 : null,

    totalHint: chunk.totalHint ?? METADATA_BUNDLED_TOTAL_HINT,

  };

}



export async function getMetadataSyncCursor(): Promise<number> {

  const raw = await getSchemaMeta(META_SYNC_CURSOR_KEY);

  if (!raw) return 0;

  const n = parseInt(raw, 10);

  return Number.isFinite(n) ? n : 0;

}



async function setMetadataSyncCursor(cursor: number): Promise<void> {

  await setSchemaMeta(META_SYNC_CURSOR_KEY, String(cursor));

}



export async function isBundledMetadataSeeded(): Promise<boolean> {

  return (await getSchemaMeta(META_SYNC_DONE_KEY)) === '1';

}



async function markBundledSeeded(): Promise<void> {

  await setSchemaMeta(META_SYNC_DONE_KEY, '1');

  await setSchemaMeta(META_BUNDLED_VERSION_KEY, METADATA_BUNDLED_VERSION);

}



/** Re-import when bundled catalog version or track count is below target. */

export async function needsBundledMetadataResync(): Promise<boolean> {

  const settings = await getProviderSettings();

  if (settings.metadataSyncBaseUrl?.trim()) return false;



  const ver = await getSchemaMeta(META_BUNDLED_VERSION_KEY);

  if (ver !== METADATA_BUNDLED_VERSION) return true;



  const count = await getMetadataTrackCount();

  const expected = Math.min(METADATA_BUNDLED_TOTAL_HINT, METADATA_CATALOG_TARGET);

  return count < Math.floor(expected * 0.9);

}



async function resetBundledSyncState(): Promise<void> {

  await setSchemaMeta(META_SYNC_CURSOR_KEY, '0');

  await setSchemaMeta(META_SYNC_DONE_KEY, '');

}



/**

 * Import one batch from server URL or bundled JSON chunk.

 * Returns next cursor (null = finished).

 */

export async function importMetadataBatch(cursor: number): Promise<{

  nextCursor: number | null;

  imported: { artists: number; tracks: number };

  source: 'server' | 'bundled';

}> {

  const settings = await getProviderSettings();

  const baseUrl = settings.metadataSyncBaseUrl?.trim();



  let batch: MetadataBatchPayload;

  let source: 'server' | 'bundled';



  if (baseUrl) {

    batch = await fetchMetadataBatchFromServer(baseUrl, cursor, BATCH_SIZE);

    source = 'server';

  } else {

    const bundled = bundledBatchAt(cursor);

    if (!bundled) {

      return { nextCursor: null, imported: { artists: 0, tracks: 0 }, source: 'bundled' };

    }

    batch = bundled;

    source = 'bundled';

  }



  const imported = await upsertMetadataBatch(batch.artists, batch.tracks);

  const next =

    batch.nextCursor ??

    (source === 'bundled' && cursor + 1 < getBundledMetadataChunks().length ? cursor + 1 : null);

  if (next != null) await setMetadataSyncCursor(next);

  else await setSchemaMeta(META_SYNC_CURSOR_KEY, 'done');



  return { nextCursor: next, imported, source };

}



/**

 * Sync all pending bundled chunks or server pages (with progress callback).

 */

export async function syncAllMetadata(

  onProgress?: (p: MetadataSyncProgress) => void,

): Promise<{ totalTracks: number }> {

  return runMetadataImportExclusive(() => syncAllMetadataInner(onProgress));

}



async function syncAllMetadataInner(

  onProgress?: (p: MetadataSyncProgress) => void,

): Promise<{ totalTracks: number }> {

  let cursor = await getMetadataSyncCursor();

  if (cursor === -1 || (await getSchemaMeta(META_SYNC_CURSOR_KEY)) === 'done') {

    const count = await getMetadataTrackCount();

    onProgress?.({

      phase: 'done',

      batchIndex: 0,

      batchTotal: 0,

      tracksImported: count,

      message:

        count >= METADATA_CATALOG_TARGET

          ? `Каталог: ${count} треков (метаданные)`

          : 'Каталог метаданных уже загружен',

    });

    return { totalTracks: count };

  }



  const settings = await getProviderSettings();

  const useServer = Boolean(settings.metadataSyncBaseUrl?.trim());

  const batchTotal = useServer ? 10 : getBundledMetadataChunks().length;

  let tracksImported = 0;

  let batchIndex = 0;



  onProgress?.({

    phase: 'syncing',

    batchIndex: 0,

    batchTotal,

    tracksImported: 0,

    message: 'Загрузка каталога…',

  });



  try {

    while (true) {

      const { nextCursor, imported, source } = await importMetadataBatch(cursor);

      tracksImported += imported.tracks;

      batchIndex += 1;



      onProgress?.({

        phase: 'syncing',

        batchIndex,

        batchTotal,

        tracksImported,

        message: `Загрузка каталога: группа ${batchIndex}/${batchTotal}`,

      });



      if (nextCursor == null) break;

      cursor = nextCursor;

      if (source === 'server' && batchIndex >= batchTotal) break;

    }



    if (!useServer) await markBundledSeeded();



    const finalCount = await getMetadataTrackCount();

    onProgress?.({

      phase: 'done',

      batchIndex: batchTotal,

      batchTotal,

      tracksImported: finalCount,

      message:

        finalCount >= METADATA_CATALOG_TARGET

          ? `Готово: ${finalCount} треков (метаданные)`

          : `Готово: ${finalCount} треков в каталоге`,

    });

    return { totalTracks: finalCount };

  } catch (e) {

    const msg = formatMetadataSyncError(e);

    onProgress?.({

      phase: 'error',

      batchIndex,

      batchTotal,

      tracksImported,

      message: msg,

    });

    throw e;

  }

}



let backgroundIndexStarted = false;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Non-blocking SQLite index: one bundled chunk per tick.
 * Search works immediately via bundled JSON scan (`metadataSearch.ts`).
 */
export function startBackgroundIndex(
  onProgress?: (p: MetadataSyncProgress) => void,
): void {
  if (backgroundIndexStarted) return;
  void (async () => {
    const settings = await getProviderSettings();
    if (settings.metadataSyncBaseUrl?.trim()) return;
    if (!settings.metadataFullIndexOffline) return;

    const mustResync = await needsBundledMetadataResync();
    if (!mustResync && (await isBundledMetadataSeeded())) {
      const count = await getMetadataTrackCount();
      onProgress?.({
        phase: 'done',
        batchIndex: getBundledMetadataChunks().length,
        batchTotal: getBundledMetadataChunks().length,
        tracksImported: count,
        message: `Офлайн-индекс: ${count} треков`,
      });
      return;
    }

    backgroundIndexStarted = true;
    try {
      if (mustResync) await resetBundledSyncState();

      let cursor = await getMetadataSyncCursor();
      if (cursor === -1 || (await getSchemaMeta(META_SYNC_CURSOR_KEY)) === 'done') {
        cursor = 0;
      }

      const batchTotal = getBundledMetadataChunks().length;
      let batchIndex = 0;
      let tracksImported = await getMetadataTrackCount();

      onProgress?.({
        phase: 'syncing',
        batchIndex: 0,
        batchTotal,
        tracksImported,
        message: 'Фоновая индексация каталога…',
      });

      while (true) {
        const { nextCursor, imported } = await runMetadataImportExclusive(() =>
          importMetadataBatch(cursor),
        );
        tracksImported += imported.tracks;
        batchIndex += 1;

        onProgress?.({
          phase: 'syncing',
          batchIndex,
          batchTotal,
          tracksImported,
          message: `Индекс: группа ${batchIndex}/${batchTotal}`,
        });

        if (nextCursor == null) break;
        cursor = nextCursor;
        await delay(BACKGROUND_BATCH_DELAY_MS);
      }

      await markBundledSeeded();
      const finalCount = await getMetadataTrackCount();
      onProgress?.({
        phase: 'done',
        batchIndex: batchTotal,
        batchTotal,
        tracksImported: finalCount,
        message: `Офлайн-индекс готов: ${finalCount} треков`,
      });
    } catch (e) {
      onProgress?.({
        phase: 'error',
        batchIndex: 0,
        batchTotal: getBundledMetadataChunks().length,
        tracksImported: await getMetadataTrackCount(),
        message: formatMetadataSyncError(e),
      });
    } finally {
      backgroundIndexStarted = false;
    }
  })();
}

/** @deprecated Use `startBackgroundIndex` when `metadataFullIndexOffline` is enabled. No-op otherwise. */
export async function ensureBundledMetadataSeed(
  onProgress?: (p: MetadataSyncProgress) => void,
): Promise<void> {
  const settings = await getProviderSettings();
  if (!settings.metadataFullIndexOffline) return;
  startBackgroundIndex(onProgress);
}

