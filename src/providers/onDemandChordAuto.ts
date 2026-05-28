import { ensureAutoChordProxySettings } from './autoChordProxy';
import { fetchAmdmChordSheet } from './amdmProvider';
import {
  ChordFetchError,
  type ChordFetchProgress,
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
import type { OnDemandChordProviderId, SongDetail } from './types';

export type OnDemandAutoProgress =
  | { source: 'ultimate_guitar'; stage: ChordFetchStage }
  | { source: 'amdm'; stage: ChordFetchStage }
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

function sourceLabel(source: OnDemandChordProviderId): string {
  if (source === 'ultimate_guitar') return 'UG';
  if (source === 'pesni_ru') return 'pesni.ru';
  return 'AmDm';
}

export function shortOnDemandError(e: unknown, source: OnDemandChordProviderId): string {
  if (source === 'pesni_ru') {
    if (e instanceof PesniRuError) return e.message;
    return pesniRuErrorMessage(e);
  }
  if (e instanceof ChordFetchError) {
    const msg = e.message.trim();
    if (msg.length > 120) return `${msg.slice(0, 117)}…`;
    return msg;
  }
  return 'Не удалось';
}

/** One short Russian message when every source failed. */
export function formatAutoChainFailureMessage(attempts: OnDemandChainAttempt[]): string {
  const tried = attempts.filter(a => !a.skipped && a.error.trim());
  const skippedProxy = attempts.filter(
    a =>
      a.skipped &&
      (a.source === 'amdm' || a.source === 'ultimate_guitar') &&
      a.skipReason?.includes('прокси'),
  );
  if (skippedProxy.length >= 1 && tried.length === 0) {
    return 'Запустите npm run dev-proxy на ПК (одна Wi‑Fi с телефоном).';
  }

  const failedAmdm = tried.some(a => a.source === 'amdm');
  const failedUg = tried.some(a => a.source === 'ultimate_guitar');
  if (failedAmdm && failedUg) return 'Не найдено';
  if (failedAmdm || failedUg) return 'Не найдено';

  if (tried.length === 0) return 'Не найдено';
  return tried[0].error.length > 80 ? 'Не найдено' : tried[0].error;
}

function resolveChainOrder(settings: ProviderSettings): OnDemandChordProviderId[] {
  if (settings.onDemandChordSource === 'ultimate_guitar') return ['ultimate_guitar'];
  if (settings.onDemandChordSource === 'amdm') return ['amdm'];
  if (settings.onDemandChordSource === 'pesni_ru') return ['pesni_ru'];
  return ['amdm', 'ultimate_guitar'];
}

function canTrySource(
  settings: ProviderSettings,
  source: OnDemandChordProviderId,
  proxyUrl: string,
): boolean {
  if (source === 'pesni_ru') return settings.enabled.pesni_ru === true;
  if (source === 'ultimate_guitar') {
    if (settings.enabled.ultimate_guitar === false) return false;
    return !!proxyUrl;
  }
  if (settings.enabled.amdm === false) return false;
  return !!proxyUrl;
}

function skipReasonFor(
  settings: ProviderSettings,
  source: OnDemandChordProviderId,
  proxyUrl: string,
): string {
  if (source === 'pesni_ru' && settings.enabled.pesni_ru === false) {
    return 'отключено';
  }
  if (source === 'ultimate_guitar' && settings.enabled.ultimate_guitar === false) {
    return 'отключено';
  }
  if (source === 'amdm' && settings.enabled.amdm === false) return 'отключено';
  if ((source === 'amdm' || source === 'ultimate_guitar') && !proxyUrl) {
    return 'нет прокси';
  }
  return 'недоступен';
}

/**
 * Auto on-demand tab: AmDm → Ultimate Guitar (dev-proxy). pesni.ru — только если явно включён.
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

  const chain = resolveChainOrder(settings);
  const attempts: OnDemandChainAttempt[] = [];

  for (const source of chain) {
    if (!canTrySource(settings, source, proxyUrl)) {
      attempts.push({
        source,
        error: '',
        skipped: true,
        skipReason: skipReasonFor(settings, source, proxyUrl),
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
              })
            : await fetchAmdmChordSheet(artist, title, (stage: ChordFetchStage) => {
                options?.onProgress?.({ source: 'amdm', stage });
              });

      return { detail, provider: source, attempts };
    } catch (e) {
      attempts.push({ source, error: shortOnDemandError(e, source) });
    }
  }

  throw new ChordFetchError(formatAutoChainFailureMessage(attempts));
}
