import Constants from 'expo-constants';

const CHORD_FETCH_PROXY_PORT = 8787;

export type ChordFetchUrlSource = 'settings' | 'env' | 'metro' | 'app_extra' | 'none';

export type ResolvedChordFetchUrl = {
  url: string;
  source: ChordFetchUrlSource;
  /** Human-readable label for settings / dev UI */
  sourceLabel: string;
};

/** One-liner for errors / alerts — copy-friendly. */
export const CHORD_FETCH_DEV_PROXY_CMD = 'npm run chords:dev';

export type EffectiveChordFetchOptions = {
  /** User manually saved URL in ⚙ (do not override Vercel with Metro). */
  userExplicit?: boolean;
};

/** Host from Expo debugger string `192.168.x.x:8081` or hostname. */
export function parseHostFromDebuggerHost(debuggerHost: string): string | null {
  const raw = debuggerHost.trim();
  if (!raw) return null;
  const host = raw.split(':')[0]?.trim();
  if (!host) return null;
  return host;
}

/** `http://<host>:8787/fetch` — dev-proxy on the same machine as Metro. */
export function buildChordFetchProxyUrl(host: string): string {
  return `http://${host}:${CHORD_FETCH_PROXY_PORT}/fetch`;
}

/** Vercel serverless path (optional deploy — not the default path). */
export const CHORD_FETCH_API_PATH = '/api/fetch-chords';
export const CHORD_SEARCH_API_PATH = '/api/search-chords';

/** POST endpoint for live AmDm/UG catalog search (paired with /fetch). */
export function buildChordSearchProxyUrl(proxyFetchUrl: string): string {
  const trimmed = proxyFetchUrl.trim().replace(/\/+$/, '');
  if (/\/fetch$/i.test(trimmed)) {
    return trimmed.replace(/\/fetch$/i, '/search');
  }
  try {
    const u = new URL(trimmed);
    if (u.pathname.includes('fetch-chords')) {
      u.pathname = CHORD_SEARCH_API_PATH;
      return u.href;
    }
    u.pathname = u.pathname.replace(/\/?$/, '') + '/search';
    return u.href;
  } catch {
    return `${trimmed}/search`;
  }
}

export function isLocalChordFetchProxyUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    if (u.port === String(CHORD_FETCH_PROXY_PORT)) return true;
    if (u.pathname.replace(/\/+$/, '').endsWith('/fetch')) return true;
  } catch {
    return /:8787\b/.test(t) || /\/fetch\/?$/i.test(t);
  }
  return false;
}

export function isVercelChordFetchUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    if (/\.vercel\.app$/i.test(u.hostname)) return true;
    if (u.pathname.includes('fetch-chords')) return true;
  } catch {
    return /vercel\.app/i.test(t);
  }
  return false;
}

/**
 * Ensure POST target ends with `/fetch` (dev-proxy) or `/api/fetch-chords` (Vercel).
 */
export function normalizeChordFetchUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (!/^https?:\/\//i.test(t)) return t;

  try {
    const u = new URL(t);
    const path = u.pathname.replace(/\/+$/, '') || '';

    if (path.endsWith('/fetch') || path.endsWith('/api/fetch-chords')) {
      return u.href.replace(/\/+$/, '');
    }

    if (u.port === String(CHORD_FETCH_PROXY_PORT)) {
      u.pathname = '/fetch';
      return u.href;
    }

    if (!path || path === '/') {
      u.pathname = CHORD_FETCH_API_PATH;
      return u.href;
    }

    if (!path.includes('fetch')) {
      u.pathname = `${path}${CHORD_FETCH_API_PATH}`;
    }
    return u.href;
  } catch {
    return t;
  }
}

/**
 * Saved URL (with Metro-priority rules), else auto: env → Metro :8787 → app.json extra.
 */
export function getEffectiveChordFetchUrl(
  savedProxyUrl?: string,
  options?: EffectiveChordFetchOptions,
): string {
  const saved = normalizeChordFetchUrl(savedProxyUrl ?? '');
  const auto = resolveChordFetchUrlDetailed();

  if (options?.userExplicit && saved) return saved;

  if (auto.source === 'metro' && auto.url) {
    if (!saved || isVercelChordFetchUrl(saved)) return auto.url;
    if (isLocalChordFetchProxyUrl(saved)) return saved;
    return auto.url;
  }

  if (saved) return saved;
  return auto.url;
}

/**
 * Auto-fill / «Подставить авто» — env and Metro only (no bundled Vercel URL).
 */
export function resolveChordFetchUrlForAutoFill(): string {
  return resolveChordFetchUrlForAutoFillDetailed().url;
}

export function resolveChordFetchUrlForAutoFillDetailed(): ResolvedChordFetchUrl {
  const fromEnv = process.env.EXPO_PUBLIC_CHORD_FETCH_URL?.trim();
  if (fromEnv) {
    return {
      url: normalizeChordFetchUrl(fromEnv),
      source: 'env',
      sourceLabel: 'EXPO_PUBLIC_CHORD_FETCH_URL',
    };
  }

  const host = readExpoDebuggerHost();
  if (host) {
    return {
      url: buildChordFetchProxyUrl(host),
      source: 'metro',
      sourceLabel: `Прокси на ПК (${host}:8787)`,
    };
  }

  return { url: '', source: 'none', sourceLabel: 'не найден' };
}

export function resolveChordFetchUrl(): string {
  return resolveChordFetchUrlDetailed().url;
}

export function resolveChordFetchUrlDetailed(): ResolvedChordFetchUrl {
  const auto = resolveChordFetchUrlForAutoFillDetailed();
  if (auto.url) return auto;

  const fromExtra = Constants.expoConfig?.extra?.chordFetchApiUrl;
  if (typeof fromExtra === 'string' && fromExtra.trim()) {
    return {
      url: normalizeChordFetchUrl(fromExtra.trim()),
      source: 'app_extra',
      sourceLabel: 'app.json (опционально)',
    };
  }

  return { url: '', source: 'none', sourceLabel: 'не задан' };
}

function readExpoDebuggerHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const h = parseHostFromDebuggerHost(hostUri);
    if (h) return h;
  }

  const expoGo = Constants.expoGoConfig as { debuggerHost?: string; hostUri?: string } | null;
  if (expoGo?.debuggerHost) {
    const h = parseHostFromDebuggerHost(expoGo.debuggerHost);
    if (h) return h;
  }
  if (expoGo?.hostUri) {
    const h = parseHostFromDebuggerHost(expoGo.hostUri);
    if (h) return h;
  }

  const manifest2 = Constants.manifest2 as
    | { extra?: { expoGo?: { debuggerHost?: string; hostUri?: string } } }
    | null
    | undefined;
  const expoGoHost = manifest2?.extra?.expoGo?.debuggerHost ?? manifest2?.extra?.expoGo?.hostUri;
  if (expoGoHost) {
    const h = parseHostFromDebuggerHost(expoGoHost);
    if (h) return h;
  }

  const legacyManifest = Constants.manifest as { debuggerHost?: string } | null | undefined;
  if (legacyManifest?.debuggerHost) {
    const h = parseHostFromDebuggerHost(legacyManifest.debuggerHost);
    if (h) return h;
  }

  const linking = Constants.linkingUrl;
  if (linking) {
    try {
      const u = new URL(linking);
      if (u.hostname) return u.hostname;
    } catch {
      /* ignore */
    }
  }

  return null;
}

/** Short hint when chord-fetch endpoint is not configured. */
export function chordFetchSetupHint(): string {
  return (
    'Табы подгружаются автоматически при выборе песни.\n' +
    'AmDm и Ultimate Guitar — через прокси на ПК (npm start поднимет его сам).\n' +
    'Без ПК — тихий fallback на pesni.ru с телефона.'
  );
}

export function chordFetchDevProxyErrorSuffix(): string {
  return `Запустите на ПК: ${CHORD_FETCH_DEV_PROXY_CMD}`;
}
