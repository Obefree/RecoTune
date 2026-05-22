import {
  chordCacheToSongDetail,
  getChordCache,
  setChordCache,
  type ChordCachePayload,
} from '../db/chordCache';
import { parseChordProText, chordProToSongEntry } from '../utils/chordProParse';
import { normalizeLyricsChords } from '../utils/chordLyricsNormalize';
import { combinedArtistTitle } from '../utils/searchNormalize';
import { resolveChordFetchUrl } from './chordFetchUrl';
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

export type ChordProxyResponse = {
  chordPro?: string;
  text?: string;
  title?: string;
  artist?: string;
  sourceUrl?: string;
};

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
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain' },
      body: JSON.stringify({
        provider,
        artist: artist.trim(),
        title: title.trim(),
      }),
    });
  } catch {
    throw new ChordFetchError(
      'Не удалось подгрузить таб. Проверьте интернет или адрес подгрузки (Vercel / dev-proxy).',
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
    if (!data.chordPro?.trim() && !data.text?.trim()) {
      throw new ChordFetchError('Пустой ответ при подгрузке таба.');
    }
    return data;
  }

  const text = (await res.text()).trim();
  if (!text) {
    throw new ChordFetchError('Пустой ответ при подгрузке таба.');
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

export async function fetchOnDemandChordSheet(
  provider: OnDemandChordProviderId,
  artist: string,
  title: string,
  attribution: () => ProviderAttribution,
): Promise<SongDetail> {
  await ensureAutoChordProxySettings();
  const settings = await getProviderSettings();
  const proxyUrl = settings.chordFetchProxyUrl.trim() || resolveChordFetchUrl();
  if (!proxyUrl) {
    throw new ChordFetchError(
      'Подгрузка табов недоступна. Укажите EXPO_PUBLIC_CHORD_FETCH_URL, разверните API на Vercel или запустите dev-proxy.',
    );
  }

  const id = stableOnDemandUserId(provider, title, artist);
  const cached = await getChordCache(provider, artist, title);
  if (cached) {
    return chordCacheToSongDetail(cached, provider, id, attribution());
  }

  const raw = await postChordFetchProxy(provider, artist, title, proxyUrl);
  const payload = proxyResponseToPayload(raw, artist, title);
  await setChordCache(provider, artist, title, payload);

  return chordCacheToSongDetail(payload, provider, id, {
    ...attribution(),
    url: payload.sourceUrl ?? attribution().url,
  });
}
