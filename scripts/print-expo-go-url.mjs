#!/usr/bin/env node
/**
 * Reads the dev manifest from Metro and prints an exp:// URL for Expo Go.
 * Metro must be running (e.g. after `npx expo start --tunnel`).
 *
 * Usage: node scripts/print-expo-go-url.mjs [port]
 *        EXPO_PORT=8082 node scripts/print-expo-go-url.mjs
 */
const port = process.env.EXPO_PORT || process.argv[2] || '8081';
const manifestUrl = `http://127.0.0.1:${port}`;

try {
  const res = await fetch(manifestUrl);
  if (!res.ok) {
    console.error(`HTTP ${res.status} from ${manifestUrl}`);
    process.exit(1);
  }
  const j = await res.json();
  const bundleUrl = j.launchAsset?.url;
  if (!bundleUrl || typeof bundleUrl !== 'string') {
    console.error('Manifest has no launchAsset.url — is this an Expo project?');
    process.exit(1);
  }
  const u = new URL(bundleUrl);
  const expPort = u.port || (u.protocol === 'https:' ? '443' : '80');
  const expUrl = `exp://${u.hostname}:${expPort}`;
  console.log('Expo Go — откройте в приложении (Enter URL manually / подключение по URL):');
  console.log(expUrl);
  console.log('');
  console.log('Metro manifest:', manifestUrl);
} catch (e) {
  console.error('Не удалось прочитать манифест. Запущен ли сервер? Пример:');
  console.error('  npx expo start --tunnel');
  console.error(e?.message || e);
  process.exit(1);
}
