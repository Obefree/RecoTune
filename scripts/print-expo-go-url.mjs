#!/usr/bin/env node
/**
 * Reads the Metro manifest from the running Expo server and prints the exp:// URL.
 * Usage: node scripts/print-expo-go-url.mjs [port]
 */
import http from 'http';

const port = process.argv[2] || process.env.EXPO_PORT || 8081;

const options = {
  hostname: 'localhost',
  port,
  path: '/',
  headers: { 'Expo-Platform': 'android' },
};

const req = http.get(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const manifest = JSON.parse(data);
      const debuggerHost = manifest.debuggerHost || manifest.hostUri || `localhost:${port}`;
      const url = `exp://${debuggerHost}`;
      console.log('Expo Go URL:', url);
    } catch {
      console.log(`exp://localhost:${port}`);
    }
  });
});

req.on('error', () => {
  console.log(`exp://localhost:${port}`);
});
