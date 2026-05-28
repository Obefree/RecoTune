/** Low-level client for https://pesni.ru/api/v1 (no API key; 60 req/min per IP). */

export const PESNI_RU_API_BASE = 'https://pesni.ru/api/v1';

export type PesniRuArtist = {
  id: number;
  name: string;
  slug: string;
};

export type PesniRuTrackSummary = {
  id: number;
  name: string;
  slug: string;
  artist: PesniRuArtist;
};

export type PesniRuSearchResponse = {
  artists?: PesniRuArtist[];
  tracks?: PesniRuTrackSummary[];
};

export type PesniRuTrackDetail = PesniRuTrackSummary & {
  text?: string | null;
  description?: string | null;
  trivia?: string | null;
};

export type PesniRuRateLimit = {
  limit?: number;
  remaining?: number;
};

export class PesniRuError extends Error {
  readonly status?: number;
  readonly rateLimit?: PesniRuRateLimit;
  readonly retryAfterSec?: number;

  constructor(
    message: string,
    opts?: { status?: number; rateLimit?: PesniRuRateLimit; retryAfterSec?: number },
  ) {
    super(message);
    this.name = 'PesniRuError';
    this.status = opts?.status;
    this.rateLimit = opts?.rateLimit;
    this.retryAfterSec = opts?.retryAfterSec;
  }
}

export const PESNI_RU_TIMEOUT_MS = 15_000;

function parseRateLimitHeaders(headers: Headers): PesniRuRateLimit {
  const limit = headers.get('X-RateLimit-Limit');
  const remaining = headers.get('X-RateLimit-Remaining');
  return {
    limit: limit ? Number.parseInt(limit, 10) : undefined,
    remaining: remaining ? Number.parseInt(remaining, 10) : undefined,
  };
}

function rateLimitMessage(_rate: PesniRuRateLimit, retryAfterSec?: number): string {
  if (retryAfterSec != null && retryAfterSec > 0) {
    return `Слишком много запросов к pesni.ru. Повторите через ~${retryAfterSec} с.`;
  }
  return 'Слишком много запросов к pesni.ru. Повторите позже.';
}

async function pesniFetchJson<T>(path: string, init?: RequestInit): Promise<{ data: T; rate: PesniRuRateLimit }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PESNI_RU_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${PESNI_RU_API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new PesniRuError(`Превышено время ожидания pesni.ru (${Math.round(PESNI_RU_TIMEOUT_MS / 1000)} с).`);
    }
    throw new PesniRuError(
      e instanceof Error && e.message ? `Нет связи с pesni.ru: ${e.message}` : 'Нет связи с pesni.ru.',
    );
  } finally {
    clearTimeout(timer);
  }

  const rate = parseRateLimitHeaders(res.headers);

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const retryAfterSec = retryAfter ? Number.parseInt(retryAfter, 10) : undefined;
    throw new PesniRuError(rateLimitMessage(rate, retryAfterSec), {
      status: 429,
      rateLimit: rate,
      retryAfterSec,
    });
  }

  if (!res.ok) {
    throw new PesniRuError(`pesni.ru ответил HTTP ${res.status}.`, { status: res.status, rateLimit: rate });
  }

  const data = (await res.json()) as T;
  return { data, rate };
}

export async function pesniRuSearch(
  query: string,
  opts?: { type?: 'all' | 'artists' | 'tracks'; limit?: number },
): Promise<PesniRuSearchResponse> {
  const q = query.trim();
  if (!q) return { artists: [], tracks: [] };
  const limit = Math.min(Math.max(opts?.limit ?? 10, 1), 50);
  const type = opts?.type ?? 'all';
  const params = new URLSearchParams({ q, type, limit: String(limit) });
  const { data } = await pesniFetchJson<PesniRuSearchResponse>(`/search?${params}`);
  return {
    artists: data.artists ?? [],
    tracks: data.tracks ?? [],
  };
}

export async function pesniRuGetTrack(slug: string): Promise<PesniRuTrackDetail> {
  const s = slug.trim();
  if (!s) throw new PesniRuError('Не указан slug трека pesni.ru.');
  const { data } = await pesniFetchJson<PesniRuTrackDetail>(`/tracks/${encodeURIComponent(s)}`);
  return data;
}
