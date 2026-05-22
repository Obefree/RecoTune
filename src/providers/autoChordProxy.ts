import { getProviderSettings, saveProviderSettings, type ProviderSettings } from './providerSettings';
import { resolveChordFetchUrl } from './chordFetchUrl';

export { parseHostFromDebuggerHost, buildChordFetchProxyUrl } from './chordFetchUrl';

export type AutoChordProxyResult = {
  /** Proxy URL is set (was already or just auto-filled). */
  configured: boolean;
  /** This call wrote chordFetchProxyUrl from env / Metro / bundled Vercel URL. */
  autoFilled: boolean;
};

/**
 * If chord-fetch URL is empty, pick EXPO_PUBLIC → Metro :8787 → app.json extra.
 * Enables «Табы онлайн» when a URL is available. Silent — no Alert.
 */
export async function ensureAutoChordProxySettings(): Promise<AutoChordProxyResult> {
  const settings = await getProviderSettings();
  if (settings.chordFetchProxyUrl.trim()) {
    return { configured: true, autoFilled: false };
  }

  const url = resolveChordFetchUrl();
  if (!url) {
    return { configured: false, autoFilled: false };
  }

  const next: ProviderSettings = {
    ...settings,
    chordFetchProxyUrl: url,
    enabled: { ...settings.enabled, amdm: true },
    devProxyUrlHintDismissed: true,
  };
  await saveProviderSettings(next);
  return { configured: true, autoFilled: true };
}
