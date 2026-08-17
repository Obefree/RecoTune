import { getProviderSettings, saveProviderSettings, type ProviderSettings } from './providerSettings';
import {
  getEffectiveChordFetchUrl,
  isVercelChordFetchUrl,
  normalizeChordFetchUrl,
  resolveChordFetchUrlForAutoFill,
  resolveChordFetchUrlForAutoFillDetailed,
} from './chordFetchUrl';

export { parseHostFromDebuggerHost, buildChordFetchProxyUrl } from './chordFetchUrl';

export type AutoChordProxyResult = {
  /** Proxy URL is set (was already or just auto-filled). */
  configured: boolean;
  /** This call wrote chordFetchProxyUrl from env / Metro. */
  autoFilled: boolean;
};

/**
 * Prefer Metro :8787 over stale Vercel URL in settings.
 * If chord-fetch URL is empty, pick EXPO_PUBLIC → Metro :8787.
 */
export async function ensureAutoChordProxySettings(): Promise<AutoChordProxyResult> {
  const settings = await getProviderSettings();
  const auto = resolveChordFetchUrlForAutoFillDetailed();

  const effective = getEffectiveChordFetchUrl(settings.chordFetchProxyUrl, {
    userExplicit: settings.chordFetchProxyUserSet === true,
  });

  if (effective) {
    const shouldUpgrade =
      auto.url &&
      settings.chordFetchProxyUrl.trim() &&
      !settings.chordFetchProxyUserSet &&
      isVercelChordFetchUrl(settings.chordFetchProxyUrl) &&
      auto.source === 'metro';

    if (!shouldUpgrade && settings.chordFetchProxyUrl.trim()) {
      return { configured: true, autoFilled: false };
    }

    if (shouldUpgrade || !settings.chordFetchProxyUrl.trim()) {
      const url = normalizeChordFetchUrl(shouldUpgrade ? auto.url : resolveChordFetchUrlForAutoFill());
      if (!url) {
        return { configured: false, autoFilled: false };
      }
      if (url === normalizeChordFetchUrl(settings.chordFetchProxyUrl) && settings.chordFetchProxyUrl.trim()) {
        return { configured: true, autoFilled: false };
      }

      const next: ProviderSettings = {
        ...settings,
        chordFetchProxyUrl: url,
        chordFetchProxyUserSet: false,
        enabled: {
          ...settings.enabled,
          amdm: true,
          ultimate_guitar: true,
          github: true,
          lyrics: true,
          chordpro_url: true,
        },
        devProxyUrlHintDismissed: true,
      };
      await saveProviderSettings(next);
      return { configured: true, autoFilled: true };
    }

    return { configured: true, autoFilled: false };
  }

  return { configured: false, autoFilled: false };
}
