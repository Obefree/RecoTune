#!/usr/bin/env node
/**
 * Reads the Metro manifest and prints the exp:// URL for Expo Go.
 * Usage: node scripts/print-expo-go-url.mjs [port]
 */
import http from 'node:http';

const port = process.argv[2] || 8081;

function fetchManifest(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Failed to parse manifest JSON')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

try {
  const manifest = await fetchManifest(port);
  const hostUri = manifest?.extra?.expoClient?.hostUri
    || manifest?.extra?.expoGo?.debuggerHost
    || `localhost:${port}`;
  const expUrl = `exp://${hostUri}`;
  console.log('\n=== Expo Go URL ===');
  console.log(expUrl);
  console.log('==================\n');
  console.log('Open Expo Go → Enter URL manually → paste the URL above');
} catch (err) {
  console.error(`Could not reach Metro on port ${port}: ${err.message}`);
  console.error('Make sure the Expo server is running (npm run start:expo)');
  process.exit(1);
}
