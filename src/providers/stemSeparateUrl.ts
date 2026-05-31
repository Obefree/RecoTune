import { readExpoDebuggerHost } from './chordFetchUrl';

export const STEM_SEPARATE_PORT = 8788;

export type StemSeparateUrlSource = 'env' | 'metro' | 'none';

export type ResolvedStemSeparateUrl = {
  separateUrl: string;
  transcribeUrl: string;
  healthUrl: string;
  source: StemSeparateUrlSource;
  sourceLabel: string;
};

export const STEM_SEPARATE_DEV_CMD = 'npm start (или npm run stems:dev)';

export function buildStemSeparateUrl(host: string): string {
  return `http://${host}:${STEM_SEPARATE_PORT}/separate`;
}

export function buildStemHealthUrl(host: string): string {
  return `http://${host}:${STEM_SEPARATE_PORT}/health`;
}

export function buildStemTranscribeUrl(host: string): string {
  return `http://${host}:${STEM_SEPARATE_PORT}/transcribe`;
}

export function stemTranscribeUrlFromSeparate(separateUrl: string): string {
  const t = separateUrl.trim().replace(/\/+$/, '');
  if (/\/separate$/i.test(t)) return t.replace(/\/separate$/i, '/transcribe');
  try {
    const u = new URL(t);
    if (u.port === String(STEM_SEPARATE_PORT)) {
      u.pathname = '/transcribe';
      return u.href.replace(/\/+$/, '');
    }
  } catch {
    /* ignore */
  }
  return `${t}/transcribe`;
}

export function stemHealthUrlFromSeparate(separateUrl: string): string {
  const t = separateUrl.trim().replace(/\/+$/, '');
  if (/\/separate$/i.test(t)) return t.replace(/\/separate$/i, '/health');
  try {
    const u = new URL(t);
    if (u.port === String(STEM_SEPARATE_PORT)) {
      u.pathname = '/health';
      return u.href.replace(/\/+$/, '');
    }
  } catch {
    /* ignore */
  }
  return `${t}/health`;
}

export function resolveStemSeparateUrlDetailed(): ResolvedStemSeparateUrl {
  const fromEnv = process.env.EXPO_PUBLIC_STEM_URL?.trim();
  if (fromEnv) {
    const separateUrl = fromEnv.replace(/\/health\/?$/i, '/separate').replace(/\/transcribe\/?$/i, '/separate').replace(/\/+$/, '');
    const resolved = /\/separate$/i.test(separateUrl) ? separateUrl : `${separateUrl}/separate`;
    return {
      separateUrl: resolved,
      transcribeUrl: stemTranscribeUrlFromSeparate(resolved),
      healthUrl: stemHealthUrlFromSeparate(resolved),
      source: 'env',
      sourceLabel: 'EXPO_PUBLIC_STEM_URL',
    };
  }

  const host = readExpoDebuggerHost();
  if (host) {
    return {
      separateUrl: buildStemSeparateUrl(host),
      transcribeUrl: buildStemTranscribeUrl(host),
      healthUrl: buildStemHealthUrl(host),
      source: 'metro',
      sourceLabel: `ПК (${host}:${STEM_SEPARATE_PORT})`,
    };
  }

  return {
    separateUrl: '',
    transcribeUrl: '',
    healthUrl: '',
    source: 'none',
    sourceLabel: 'не найден',
  };
}

export function resolveStemSeparateUrl(): string {
  return resolveStemSeparateUrlDetailed().separateUrl;
}

export function stemSeparateSetupHint(): string {
  return (
    'Нейросетевые функции (Demucs, basic-pitch) работают через ПК в той же Wi‑Fi сети.\n' +
    `На ПК: ${STEM_SEPARATE_DEV_CMD}\n` +
    'Установка Python: tools/stem-separate/README.md'
  );
}
