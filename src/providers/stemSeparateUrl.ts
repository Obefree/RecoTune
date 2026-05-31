import Constants from 'expo-constants';

import { readExpoDebuggerHost } from './chordFetchUrl';

export const STEM_SEPARATE_PORT = 8788;

export type StemSeparateUrlSource = 'env' | 'env_base' | 'app_extra' | 'metro' | 'none';

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

function normalizeStemServerBase(url: string): string {
  return url
    .trim()
    .replace(/\/health\/?$/i, '')
    .replace(/\/transcribe\/?$/i, '')
    .replace(/\/separate\/?$/i, '')
    .replace(/\/+$/, '');
}

function resolvedFromSeparateUrl(
  separateUrl: string,
  source: StemSeparateUrlSource,
  sourceLabel: string,
): ResolvedStemSeparateUrl {
  const resolved = /\/separate$/i.test(separateUrl) ? separateUrl : `${separateUrl}/separate`;
  return {
    separateUrl: resolved.replace(/\/+$/, ''),
    transcribeUrl: stemTranscribeUrlFromSeparate(resolved),
    healthUrl: stemHealthUrlFromSeparate(resolved),
    source,
    sourceLabel,
  };
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

/** Full `/separate` URL override (legacy). */
function resolveStemSeparateUrlFromLegacyEnv(): ResolvedStemSeparateUrl | null {
  const fromEnv = process.env.EXPO_PUBLIC_STEM_URL?.trim();
  if (!fromEnv) return null;
  const separateUrl = fromEnv
    .replace(/\/health\/?$/i, '/separate')
    .replace(/\/transcribe\/?$/i, '/separate')
    .replace(/\/+$/, '');
  const resolved = /\/separate$/i.test(separateUrl) ? separateUrl : `${separateUrl}/separate`;
  return resolvedFromSeparateUrl(resolved, 'env', 'EXPO_PUBLIC_STEM_URL');
}

export function resolveStemSeparateUrlForAutoFillDetailed(): ResolvedStemSeparateUrl {
  const fromEnv = process.env.EXPO_PUBLIC_STEM_SERVER_URL?.trim();
  if (fromEnv) {
    const base = normalizeStemServerBase(fromEnv);
    return resolvedFromSeparateUrl(
      `${base}/separate`,
      'env_base',
      'EXPO_PUBLIC_STEM_SERVER_URL',
    );
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

export function resolveStemSeparateUrlDetailed(): ResolvedStemSeparateUrl {
  const legacy = resolveStemSeparateUrlFromLegacyEnv();
  if (legacy?.separateUrl) return legacy;

  const auto = resolveStemSeparateUrlForAutoFillDetailed();
  if (auto.separateUrl) return auto;

  const fromExtra = Constants.expoConfig?.extra?.stemServerUrl;
  if (typeof fromExtra === 'string' && fromExtra.trim()) {
    const base = normalizeStemServerBase(fromExtra.trim());
    return resolvedFromSeparateUrl(
      `${base}/separate`,
      'app_extra',
      'app.config (stemServerUrl)',
    );
  }

  return {
    separateUrl: '',
    transcribeUrl: '',
    healthUrl: '',
    source: 'none',
    sourceLabel: 'не задан',
  };
}

export function resolveStemSeparateUrl(): string {
  return resolveStemSeparateUrlDetailed().separateUrl;
}

export function stemSeparateSetupHint(): string {
  return (
    'Нейросетевые функции (Demucs, basic-pitch) работают через ПК в той же Wi‑Fi сети.\n' +
    `На ПК: ${STEM_SEPARATE_DEV_CMD}\n` +
    'Установка Python: tools/stem-separate/README.md\n' +
    'Для APK без ПК: EXPO_PUBLIC_STEM_SERVER_URL при сборке.'
  );
}
