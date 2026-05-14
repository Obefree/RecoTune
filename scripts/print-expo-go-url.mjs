#!/usr/bin/env node
/**
 * Prints exp:// URL from Metro manifest (same machine as Metro).
 * Usage: EXPO_PORT=8081 node scripts/print-expo-go-url.mjs
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
    console.error('Manifest has no launchAsset.url.');
    process.exit(1);
  }
  const u = new URL(bundleUrl);
  const expPort = u.port || (u.protocol === 'https:' ? '443' : '80');
  console.log(`exp://${u.hostname}:${expPort}`);
} catch (e) {
  console.error('Metro not reachable. Is expo start running?', e?.message || e);
  process.exit(1);
}
