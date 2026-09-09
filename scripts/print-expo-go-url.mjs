#!/usr/bin/env node
/**
 * Reads the running Metro manifest and prints the exp:// URL for Expo Go.
 * Usage: node scripts/print-expo-go-url.mjs [port]
 */
const port = process.argv[2] || 8081;
const url = `http://localhost:${port}`;

try {
  const res = await fetch(`${url}/`);
  const text = await res.text();
  // Metro returns plain text with the exp:// URL in the manifest
  const match = text.match(/exp:\/\/[^\s"]+/);
  if (match) {
    console.log('Expo Go URL:', match[0]);
  } else {
    // Fallback: print local tunnel URL if provided via env
    const tunnel = process.env.EXPO_TUNNEL_URL;
    if (tunnel) {
      console.log('Tunnel URL:', tunnel);
    } else {
      console.log('Metro is running at', url);
      console.log('Open Expo Go → Enter URL manually:', url);
    }
  }
} catch (e) {
  console.error('Metro not reachable on port', port, '-', e.message);
  process.exit(1);
}
