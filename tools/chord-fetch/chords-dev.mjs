#!/usr/bin/env node
/**
 * Ensures ultimate-api (:5000) + dev-proxy (:8787) are running for local chord fetch.
 * Spawns dev-stack detached if ports are closed. Exits quickly — safe for npm start pre-hook.
 */
import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROXY_PORT = Number(process.env.CHORD_FETCH_PORT || 8787);
const ULTIMATE_PORT = Number(process.env.ULTIMATE_API_PORT || 5000);
const WAIT_MS = Number(process.env.CHORDS_DEV_WAIT_MS || 12_000);
const POLL_MS = 500;

const here = path.dirname(fileURLToPath(import.meta.url));

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(900, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForPort(port, label) {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) {
      console.log(`[chords:dev] ${label} ready on :${port}`);
      return true;
    }
    await sleep(POLL_MS);
  }
  return false;
}

async function main() {
  const proxyUp = await isPortOpen(PROXY_PORT);
  const ultimateUp = await isPortOpen(ULTIMATE_PORT);

  if (proxyUp && ultimateUp) {
    console.log(`[chords:dev] already running (:${ULTIMATE_PORT}, :${PROXY_PORT})`);
    return;
  }

  if (proxyUp && !ultimateUp) {
    console.warn(`[chords:dev] :${PROXY_PORT} up but :${ULTIMATE_PORT} down — restarting stack`);
  } else if (!proxyUp && ultimateUp) {
    console.warn(`[chords:dev] :${ULTIMATE_PORT} up but :${PROXY_PORT} down — restarting stack`);
  } else {
    console.log('[chords:dev] starting dev-stack (ultimate-api + dev-proxy)…');
  }

  const stack = path.join(here, 'dev-stack.mjs');
  const child = spawn(process.execPath, [stack], {
    cwd: here,
    detached: true,
    stdio: 'ignore',
    shell: process.platform === 'win32',
    env: process.env,
  });
  child.unref();

  const proxyReady = await waitForPort(PROXY_PORT, 'dev-proxy');
  if (!proxyReady) {
    console.warn(
      `[chords:dev] :${PROXY_PORT} not ready after ${WAIT_MS / 1000}s — run "npm run dev-stack" manually if tabs fail`,
    );
    return;
  }
  await waitForPort(ULTIMATE_PORT, 'ultimate-api');
}

main().catch(err => {
  console.error('[chords:dev]', err);
  process.exit(1);
});
