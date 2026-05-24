import Constants from 'expo-constants';

const CHORD_FETCH_PROXY_PORT = 8787;

export type ChordFetchUrlSource = 'settings' | 'env' | 'metro' | 'app_extra' | 'none';

export type ResolvedChordFetchUrl = {
  url: string;
  source: ChordFetchUrlSource;
  /** Human-readable label for settings / dev UI */
  sourceLabel: string;
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

/** Placeholder — replace after deploying RecoTune to your Vercel project. */
export const CHORD_FETCH_API_PATH = '/api/fetch-chords';

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
 * Saved settings URL wins, then env → Metro :8787 → app.json extra (all normalized).
 */
export function getEffectiveChordFetchUrl(savedProxyUrl?: string): string {
  const fromSettings = normalizeChordFetchUrl(savedProxyUrl ?? '');
  if (fromSettings) return fromSettings;
  return resolveChordFetchUrl();
}

/**
 * Priority (first non-empty wins for auto-fill):
 * 1. EXPO_PUBLIC_CHORD_FETCH_URL
 * 2. Expo Metro debugger host → http://host:8787/fetch (dev-proxy)
 * 3. app.json `expo.extra.chordFetchApiUrl` (your deployed Vercel URL)
 */
export function resolveChordFetchUrl(): string {
  return resolveChordFetchUrlDetailed().url;
}

export function resolveChordFetchUrlDetailed(): ResolvedChordFetchUrl {
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
      sourceLabel: `Metro (${host}:8787)`,
    };
  }

  const fromExtra = Constants.expoConfig?.extra?.chordFetchApiUrl;
  if (typeof fromExtra === 'string' && fromExtra.trim()) {
    return {
      url: normalizeChordFetchUrl(fromExtra.trim()),
      source: 'app_extra',
      sourceLabel: 'app.json chordFetchApiUrl',
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

/** Short hint when no chord-fetch endpoint is reachable from auto-detection. */
export function chordFetchSetupHint(): string {
  return (
    'Нет API табов. Варианты:\n' +
    '• Vercel: https://<проект>.vercel.app/api/fetch-chords — вставьте в ⚙ ниже или EXPO_PUBLIC_CHORD_FETCH_URL\n' +
    '• Dev: на ПК `npm run dev-proxy`, телефон и ПК в одной Wi‑Fi (Expo Go подставит :8787)'
  );
}
