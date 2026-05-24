import {
  chordCacheToSongDetail,
  getChordCache,
  setChordCache,
  type ChordCachePayload,
} from '../db/chordCache';
import { parseChordProText, chordProToSongEntry } from '../utils/chordProParse';
import { normalizeLyricsChords } from '../utils/chordLyricsNormalize';
import { combinedArtistTitle } from '../utils/searchNormalize';
import { getEffectiveChordFetchUrl } from './chordFetchUrl';
import { ensureAutoChordProxySettings } from './autoChordProxy';
import { getProviderSettings } from './providerSettings';
import type {
  OnDemandChordProviderId,
  ProviderAttribution,
  SongDetail,
} from './types';

export class ChordFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChordFetchError';
  }
}

export const CHORD_FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = CHORD_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new ChordFetchError(
        `Превышено время ожидания (${Math.round(timeoutMs / 1000)} с). Проверьте Vercel /api/fetch-chords или dev-proxy :8787.`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export type ChordProxyResponse = {
  chordPro?: string;
  text?: string;
  title?: string;
  artist?: string;
  sourceUrl?: string;
  stub?: boolean;
  error?: string;
};

/** Server-side placeholder when AmDm is unreachable or parse failed — must not be shown as a real tab. */
export function isChordProStubBody(body: string): boolean {
  const t = body.trim();
  if (!t) return true;
  if (/\{comment:\s*stub/i.test(t)) return true;
  if (/Тестовая заглушка/i.test(t)) return true;
  return false;
}

function stableOnDemandUserId(provider: OnDemandChordProviderId, title: string, artist: string): string {
  const prefix = provider === 'amdm' ? 'custom_amdm_' : 'custom_ug_';
  const key = combinedArtistTitle(artist, title)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `${prefix}${key || Date.now()}`;
}

export async function postChordFetchProxy(
  provider: OnDemandChordProviderId,
  artist: string,
  title: string,
  proxyUrl: string,
): Promise<ChordProxyResponse> {
  const url = proxyUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new ChordFetchError('Некорректный адрес подгрузки табов.');
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain' },
      body: JSON.stringify({
        provider,
        artist: artist.trim(),
        title: title.trim(),
      }),
    });
  } catch (e) {
    if (e instanceof ChordFetchError) throw e;
    const msg = e instanceof Error ? e.message : '';
    const cleartextHint =
      proxyUrl.startsWith('http://') && /Network request failed|cleartext/i.test(msg)
        ? ' Android блокирует http:// — используйте https:// Vercel или Expo Go + dev-proxy.'
        : '';
    throw new ChordFetchError(
      `Не удалось подгрузить таб.${cleartextHint} Проверьте интернет, dev-proxy (:8787) или Vercel /api/fetch-chords.`,
    );
  }

  if (!res.ok) {
    let detail = '';
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error?.trim()) detail = errBody.error.trim();
    } catch {
      /* not JSON */
    }
    const hint =
      res.status === 501
        ? ' Этот источник пока недоступен — используйте «Табы онлайн».'
        : res.status === 429
          ? ' Слишком много запросов — повторите позже.'
          : ' Проверьте EXPO_PUBLIC_CHORD_FETCH_URL или dev-proxy на ПК.';
    throw new ChordFetchError(
      detail || `Подгрузка таба не удалась (HTTP ${res.status}).${hint}`,
    );
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const data = (await res.json()) as ChordProxyResponse;
    if (data.stub || data.error?.trim()) {
      throw new ChordFetchError(data.error?.trim() || 'Таб не найден на сайте.');
    }
    const body = (data.chordPro ?? data.text ?? '').trim();
    if (!body) {
      throw new ChordFetchError('Пустой ответ при подгрузке таба.');
    }
    if (isChordProStubBody(body)) {
      throw new ChordFetchError('Таб не найден — проверьте исполнителя и название.');
    }
    return data;
  }

  const text = (await res.text()).trim();
  if (!text) {
    throw new ChordFetchError('Пустой ответ при подгрузке таба.');
  }
  if (isChordProStubBody(text)) {
    throw new ChordFetchError('Таб не найден — проверьте исполнителя и название.');
  }
  return { chordPro: text, title, artist };
}

function proxyResponseToPayload(
  raw: ChordProxyResponse,
  artist: string,
  title: string,
): ChordCachePayload {
  const body = (raw.chordPro ?? raw.text ?? '').trim();
  if (!body) {
    throw new ChordFetchError('Пустой текст таба.');
  }
  if (isChordProStubBody(body)) {
    throw new ChordFetchError('Таб не найден — проверьте исполнителя и название.');
  }
  const parsed = parseChordProText(body, raw.title?.trim() || title);
  const entry = chordProToSongEntry(parsed);
  const lyrics = entry.lyrics ? normalizeLyricsChords(entry.lyrics) : undefined;
  return {
    title: raw.title?.trim() || entry.title,
    artist: raw.artist?.trim() || entry.artist || artist,
    chords: entry.chords,
    lyrics,
    key: entry.key,
    bpm: entry.bpm,
    difficulty: entry.difficulty,
    sourceUrl: raw.sourceUrl,
  };
}

function artistTitleFetchVariants(artist: string, title: string): { artist: string; title: string }[] {
  const a = artist.trim();
  const t = title.trim();
  const variants: { artist: string; title: string }[] = [];
  const key = (x: { artist: string; title: string }) => `${x.artist}\0${x.title}`;
  const seen = new Set<string>();
  const add = (x: { artist: string; title: string }) => {
    if (!x.title.trim()) return;
    const k = key(x);
    if (seen.has(k)) return;
    seen.add(k);
    variants.push({ artist: x.artist.trim(), title: x.title.trim() });
  };
  add({ artist: a, title: t });
  if (a && t) add({ artist: t, title: a });
  if (t) add({ artist: a || t, title: t });
  return variants;
}

/** Quick health check for settings UI (Radiohead — Creep). */
export async function probeChordFetchEndpoint(proxyUrl: string): Promise<string> {
  const url = proxyUrl.trim();
  if (!url) return 'URL не задан';
  try {
    const raw = await postChordFetchProxy('amdm', 'Radiohead', 'Creep', url);
    const body = (raw.chordPro ?? raw.text ?? '').trim();
    if (!body || isChordProStubBody(body)) return 'Ответ пустой или заглушка';
    return `OK — ${body.split('\n').length} строк`;
  } catch (e) {
    return e instanceof ChordFetchError ? e.message : 'Проверка не удалась';
  }
}

export async function fetchOnDemandChordSheet(
  provider: OnDemandChordProviderId,
  artist: string,
  title: string,
  attribution: () => ProviderAttribution,
): Promise<SongDetail> {
  await ensureAutoChordProxySettings();
  const settings = await getProviderSettings();
  const proxyUrl = getEffectiveChordFetchUrl(settings.chordFetchProxyUrl);
  if (!proxyUrl) {
    throw new ChordFetchError(
      'Подгрузка табов недоступна. Укажите URL в ⚙ Источники, EXPO_PUBLIC_CHORD_FETCH_URL, Vercel /api/fetch-chords или dev-proxy на ПК.',
    );
  }

  if (provider === 'ultimate_guitar') {
    throw new ChordFetchError(
      'Ultimate Guitar пока недоступен — используйте «Таб из интернета» (AmDm).',
    );
  }

  const id = stableOnDemandUserId(provider, title, artist);
  const cached = await getChordCache(provider, artist, title);
  if (cached) {
    const lyrics = cached.lyrics?.trim() ?? '';
    if (!lyrics || !isChordProStubBody(lyrics)) {
      return chordCacheToSongDetail(cached, provider, id, attribution());
    }
  }

  const variants = artistTitleFetchVariants(artist, title);

  const tryVariant = async (v: { artist: string; title: string }) => {
    const raw = await postChordFetchProxy(provider, v.artist, v.title, proxyUrl);
    const payload = proxyResponseToPayload(raw, v.artist, v.title);
    if (payload.lyrics && isChordProStubBody(payload.lyrics)) {
      throw new ChordFetchError('Таб не найден — проверьте исполнителя и название.');
    }
    await setChordCache(provider, artist, title, payload);
    return chordCacheToSongDetail(payload, provider, id, {
      ...attribution(),
      url: payload.sourceUrl ?? attribution().url,
    });
  };

  try {
    return await Promise.any(
      variants.map(v =>
        tryVariant(v).catch(e => {
          if (e instanceof ChordFetchError) throw e;
          throw new ChordFetchError('Подгрузка таба не удалась.');
        }),
      ),
    );
  } catch (e) {
    if (e instanceof AggregateError) {
      const chordErr = e.errors.find(err => err instanceof ChordFetchError) as
        | ChordFetchError
        | undefined;
      throw (
        chordErr ??
        new ChordFetchError('Таб не найден. Проверьте интернет, proxy/Vercel и написание песни.')
      );
    }
    if (e instanceof ChordFetchError) throw e;
    throw new ChordFetchError('Подгрузка таба не удалась.');
  }
}
