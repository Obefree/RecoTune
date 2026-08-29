#!/usr/bin/env node
/**
 * Reads the Metro Bundler manifest and prints the exp:// URL for Expo Go.
 * Usage: node scripts/print-expo-go-url.mjs [port]
 */
import { createRequire } from 'module';
const port = process.argv[2] || 8081;

async function getExpoUrl() {
  try {
    const res = await fetch(`http://localhost:${port}/`);
    const text = await res.text();
    // Metro returns JSON with bundleUrl or we parse the exp:// URL
    const match = text.match(/"url"\s*:\s*"(exp:\/\/[^"]+)"/);
    if (match) {
      console.log('Expo Go URL:', match[1]);
      return;
    }
    // Try manifest2 endpoint
    const res2 = await fetch(`http://localhost:${port}/_expo/health`);
    if (res2.ok) {
      console.log(`Metro running on port ${port}`);
      console.log(`For LAN: exp://<your-ip>:${port}`);
    }
  } catch (e) {
    console.error('Metro not reachable on port', port, e.message);
  }
}

getExpoUrl();
