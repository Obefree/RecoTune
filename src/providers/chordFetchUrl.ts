import Constants from 'expo-constants';

const CHORD_FETCH_PROXY_PORT = 8787;

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
 * Priority (first non-empty wins for auto-fill):
 * 1. EXPO_PUBLIC_CHORD_FETCH_URL
 * 2. Expo Metro debugger host → http://host:8787/fetch (dev-proxy)
 * 3. app.json `expo.extra.chordFetchApiUrl` (your deployed Vercel URL)
 */
export function resolveChordFetchUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_CHORD_FETCH_URL?.trim();
  if (fromEnv) return fromEnv;

  const host = readExpoDebuggerHost();
  if (host) return buildChordFetchProxyUrl(host);

  const fromExtra = Constants.expoConfig?.extra?.chordFetchApiUrl;
  if (typeof fromExtra === 'string' && fromExtra.trim()) {
    return fromExtra.trim();
  }

  return '';
}

function readExpoDebuggerHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const h = parseHostFromDebuggerHost(hostUri);
    if (h) return h;
  }

  const manifest2 = Constants.manifest2 as
    | { extra?: { expoGo?: { debuggerHost?: string } } }
    | null
    | undefined;
  const expoGoHost = manifest2?.extra?.expoGo?.debuggerHost;
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
