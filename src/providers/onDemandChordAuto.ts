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
import type { OnDemandChordProviderId, SongDetail } from './types';

export type OnDemandAutoProgress =
  | { source: 'pesni_ru'; stage: PesniFetchStage }
  | { source: 'amdm'; stage: ChordFetchStage };

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
  return source === 'pesni_ru' ? 'pesni.ru' : 'AmDm';
}

export function shortOnDemandError(e: unknown, source: OnDemandChordProviderId): string {
  if (source === 'pesni_ru') {
    if (e instanceof PesniRuError) return e.message;
    return pesniRuErrorMessage(e);
  }
  if (e instanceof ChordFetchError) return e.message;
  return 'Подгрузка не удалась';
}

/** One Russian message listing what was tried (no stubs). */
export function formatAutoChainFailureMessage(attempts: OnDemandChainAttempt[]): string {
  const tried = attempts.filter(a => !a.skipped && a.error.trim());
  const skipped = attempts.filter(a => a.skipped);

  if (tried.length === 0) {
    const skipLines = skipped.map(
      a => `${sourceLabel(a.source)} (${a.skipReason ?? 'недоступен'})`,
    );
    return skipLines.length
      ? `Таб не подгружен: ${skipLines.join('; ')}.`
      : 'Таб не подгружен — проверьте интернет и написание песни.';
  }

  const triedPart = tried.map(a => `${sourceLabel(a.source)}: ${a.error}`).join('; ');
  let msg = `Таб не найден. Пробовали: ${triedPart}.`;
  if (skipped.length) {
    const skipPart = skipped
      .map(a => `${sourceLabel(a.source)} — ${a.skipReason ?? 'пропущен'}`)
      .join('; ');
    msg += ` Не пробовали: ${skipPart}.`;
  }
  return msg;
}

function resolveChainOrder(settings: ProviderSettings): OnDemandChordProviderId[] {
  if (settings.onDemandChordSource === 'amdm') return ['amdm'];
  if (settings.onDemandChordSource === 'pesni_ru') return ['pesni_ru'];
  return ['pesni_ru', 'amdm'];
}

function canTrySource(
  settings: ProviderSettings,
  source: OnDemandChordProviderId,
  proxyUrl: string,
): boolean {
  if (source === 'pesni_ru') return settings.enabled.pesni_ru !== false;
  if (settings.enabled.amdm === false) return false;
  return !!proxyUrl;
}

function skipReasonFor(
  settings: ProviderSettings,
  source: OnDemandChordProviderId,
  proxyUrl: string,
): string {
  if (source === 'pesni_ru') return 'отключено в расширенных настройках';
  if (settings.enabled.amdm === false) return 'отключено в расширенных настройках';
  if (!proxyUrl) {
    return 'прокси на ПК не найден (запустите npm run dev-proxy, одна Wi‑Fi с телефоном)';
  }
  return 'недоступен';
}

/**
 * Auto on-demand tab: pesni.ru (HTTPS) → AmDm (Metro :8787), unless advanced mode forces one source.
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
