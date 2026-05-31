import { readExpoDebuggerHost } from './chordFetchUrl';

export const STEM_SEPARATE_PORT = 8788;

export type StemSeparateUrlSource = 'env' | 'metro' | 'none';

export type ResolvedStemSeparateUrl = {
  separateUrl: string;
  healthUrl: string;
  source: StemSeparateUrlSource;
  sourceLabel: string;
};

export const STEM_SEPARATE_DEV_CMD = 'npm run stems:dev';

export function buildStemSeparateUrl(host: string): string {
  return `http://${host}:${STEM_SEPARATE_PORT}/separate`;
}

export function buildStemHealthUrl(host: string): string {
  return `http://${host}:${STEM_SEPARATE_PORT}/health`;
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
    const separateUrl = fromEnv.replace(/\/health\/?$/i, '/separate').replace(/\/+$/, '');
    return {
      separateUrl: /\/separate$/i.test(separateUrl) ? separateUrl : `${separateUrl}/separate`,
      healthUrl: stemHealthUrlFromSeparate(separateUrl),
      source: 'env',
      sourceLabel: 'EXPO_PUBLIC_STEM_URL',
    };
  }

  const host = readExpoDebuggerHost();
  if (host) {
    return {
      separateUrl: buildStemSeparateUrl(host),
      healthUrl: buildStemHealthUrl(host),
      source: 'metro',
      sourceLabel: `ПК (${host}:${STEM_SEPARATE_PORT})`,
    };
  }

  return {
    separateUrl: '',
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
    'Нейросетевое разделение (Demucs) работает через ПК в той же Wi‑Fi сети.\n' +
    `На ПК: ${STEM_SEPARATE_DEV_CMD}\n` +
    'Установка Python/Demucs: tools/stem-separate/README.md'
  );
}
