import { ensureAutoChordProxySettings } from './autoChordProxy';
import { fetchAmdmChordSheet } from './amdmProvider';
import {
  ChordFetchError,
  fetchOnDemandChordSheet,
  isChordFetchProxyReachable,
  type ChordFetchStage,
} from './chordFetchProxy';
import { getEffectiveChordFetchUrl } from './chordFetchUrl';
import { PesniRuError } from './pesniRuApi';
import {
  fetchPesniRuChordSheet,
  pesniRuErrorMessage,
  type PesniFetchProgress,
  type PesniFetchStage,
} from './pesniRuProvider';
import { getProviderSettings, type ProviderSettings } from './providerSettings';
import { fetchUltimateGuitarChordSheet } from './ultimateGuitarProvider';
import type { OnDemandChordProviderId, ProviderAttribution, SongDetail } from './types';

export type OnDemandAutoProgress =
  | { source: 'ultimate_guitar'; stage: ChordFetchStage }
  | { source: 'amdm'; stage: ChordFetchStage }
  | { source: 'github'; stage: ChordFetchStage }
  | { source: 'pesni_ru'; stage: PesniFetchStage };

export type OnDemandChainAttempt = {
  source: OnDemandChordProviderId;
  error: string;
  skipped?: boolean;
  skipReason?: string;
};

export type OnDemandAutoFetchResult = {
  detail: SongDetail;
  provider: OnDemandChordProviderId;
  attempts: OnDemandChainAttempt[];
};

export function shortOnDemandError(e: unknown, source: OnDemandChordProviderId): string {
  if (source === 'pesni_ru') {
    if (e instanceof PesniRuError) {
      const msg = e.message.trim();
      return msg.length > 80 ? 'Не найдено' : msg;
    }
    return pesniRuErrorMessage(e);
  }
  if (e instanceof ChordFetchError) {
    return 'Не найдено';
  }
  return 'Не найдено';
}

/** One short Russian message when every source failed. */
export function formatAutoChainFailureMessage(attempts: OnDemandChainAttempt[]): string {
  const pesniTry = attempts.find(a => a.source === 'pesni_ru' && !a.skipped && a.error);
  if (pesniTry?.error && pesniTry.error !== 'Не найдено') {
    return pesniTry.error.length <= 100 ? pesniTry.error : 'На pesni.ru нет verified-таба';
  }
  const proxySkipped = attempts.filter(
    a =>
      (a.source === 'amdm' || a.source === 'ultimate_guitar' || a.source === 'github') &&
      a.skipped,
  );
  const pesniFailed = attempts.find(a => a.source === 'pesni_ru' && !a.skipped);
  if (
    proxySkipped.length >= 2 &&
    pesniFailed &&
    (pesniFailed.error === 'Не найдено' || !pesniFailed.error)
  ) {
    return 'AmDm/UG/GitHub — только с ПК (npm start). На pesni.ru таб не найден.';
  }
  if (pesniFailed?.error) return pesniFailed.error;
  return 'Не найдено';
}

function resolveChainOrder(settings: ProviderSettings): OnDemandChordProviderId[] {
  if (settings.onDemandChordSource === 'ultimate_guitar') return ['ultimate_guitar'];
  if (settings.onDemandChordSource === 'amdm') return ['amdm'];
  if (settings.onDemandChordSource === 'pesni_ru') return ['pesni_ru'];
  return ['amdm', 'ultimate_guitar', 'github', 'pesni_ru'];
}

function isAutoMode(settings: ProviderSettings): boolean {
  return settings.onDemandChordSource === 'auto';
}

function canTrySource(
  settings: ProviderSettings,
  source: OnDemandChordProviderId,
  proxyUrl: string,
  proxyReachable: boolean,
): boolean {
  if (source === 'pesni_ru') {
    if (settings.onDemandChordSource === 'pesni_ru') return true;
    if (isAutoMode(settings)) return true;
    return settings.enabled.pesni_ru === true;
  }
  if (source === 'ultimate_guitar') {
    if (settings.enabled.ultimate_guitar === false) return false;
    return !!proxyUrl && proxyReachable;
  }
  if (source === 'github') {
    if (settings.enabled.github === false) return false;
    return !!proxyUrl && proxyReachable;
  }
  if (settings.enabled.amdm === false) return false;
  return !!proxyUrl && proxyReachable;
}

function skipReasonFor(
  settings: ProviderSettings,
  source: OnDemandChordProviderId,
  proxyUrl: string,
  proxyReachable: boolean,
): string {
  if (source === 'pesni_ru') {
    if (settings.onDemandChordSource === 'pesni_ru') return 'недоступен';
    if (isAutoMode(settings)) return 'пропущен';
    if (settings.enabled.pesni_ru === false) return 'отключено';
  }
  if (source === 'ultimate_guitar' && settings.enabled.ultimate_guitar === false) {
    return 'отключено';
  }
  if (source === 'github' && settings.enabled.github === false) return 'отключено';
  if (source === 'amdm' && settings.enabled.amdm === false) return 'отключено';
  if ((source === 'amdm' || source === 'ultimate_guitar' || source === 'github') && !proxyUrl) {
    return 'нет прокси';
  }
  if ((source === 'amdm' || source === 'ultimate_guitar' || source === 'github') && !proxyReachable) {
    return 'прокси недоступен';
  }
  return 'недоступен';
}

function githubAttribution(): ProviderAttribution {
  return {
    label: 'GitHub ChordPro',
    url: 'https://github.com/search?type=code&q=chordpro',
    licenseNote:
      'Публичные ChordPro (.cho/.chopro) через GitHub Search. Прокси на ПК; GITHUB_TOKEN на прокси ускоряет поиск.',
  };
}

/**
 * Auto on-demand tab: AmDm → Ultimate Guitar → GitHub ChordPro (proxy) → pesni.ru (phone fallback).
 */
export async function fetchOnDemandChordSheetAuto(
  artist: string,
  title: string,
  options?: {
    slugHint?: string;
    onProgress?: (progress: OnDemandAutoProgress) => void;
  },
): Promise<OnDemandAutoFetchResult> {
  await ensureAutoChordProxySettings();
  const settings = await getProviderSettings();
  const proxyUrl = getEffectiveChordFetchUrl(settings.chordFetchProxyUrl, {
    userExplicit: settings.chordFetchProxyUserSet === true,
  });

  const proxyReachable = proxyUrl ? await isChordFetchProxyReachable(proxyUrl) : false;

  const chain = resolveChainOrder(settings);
  const attempts: OnDemandChainAttempt[] = [];

  for (const source of chain) {
    if (!canTrySource(settings, source, proxyUrl, proxyReachable)) {
      attempts.push({
        source,
        error: '',
        skipped: true,
        skipReason: skipReasonFor(settings, source, proxyUrl, proxyReachable),
      });
      continue;
    }

    try {
      const detail =
        source === 'pesni_ru'
          ? await fetchPesniRuChordSheet(
              artist,
              title,
              (stage: PesniFetchStage) => options?.onProgress?.({ source: 'pesni_ru', stage }),
              options?.slugHint,
            )
          : source === 'ultimate_guitar'
            ? await fetchUltimateGuitarChordSheet(artist, title, (stage: ChordFetchStage) => {
                options?.onProgress?.({ source: 'ultimate_guitar', stage });
              }, { quiet: true })
            : source === 'github'
              ? await fetchOnDemandChordSheet(
                  'github',
                  artist,
                  title,
                  githubAttribution,
                  (stage: ChordFetchStage) => {
                    options?.onProgress?.({ source: 'github', stage });
                  },
                  { quiet: true },
                )
            : await fetchAmdmChordSheet(artist, title, (stage: ChordFetchStage) => {
                options?.onProgress?.({ source: 'amdm', stage });
              }, { quiet: true });

      return { detail, provider: source, attempts };
    } catch (e) {
      attempts.push({ source, error: shortOnDemandError(e, source) });
    }
  }

  throw new ChordFetchError(formatAutoChainFailureMessage(attempts));
}
