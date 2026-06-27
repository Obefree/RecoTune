#!/usr/bin/env node
/**
 * Ensures stem-separate dev-proxy (:8788) is running for Demucs / basic-pitch.
 * Spawns dev-proxy-server detached if port is closed. Safe for npm start pre-hook.
 */
import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.STEM_SEPARATE_PORT || 8788);
const WAIT_MS = Number(process.env.STEMS_DEV_WAIT_MS || 12_000);
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

async function waitForPort(port) {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) {
      console.log(`[stems:dev] dev-proxy ready on :${port}`);
      return true;
    }
    await sleep(POLL_MS);
  }
  return false;
}

async function proxyHealthy() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.ok !== false;
  } catch {
    return false;
  }
}

async function startProxy(reason) {
  if (reason) console.warn(`[stems:dev] ${reason}`);
  const script = path.join(here, 'dev-proxy-server.mjs');
  const child = spawn(process.execPath, [script], {
    cwd: here,
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
  const ready = await waitForPort(PORT);
  if (!ready) {
    console.warn(
      `[stems:dev] :${PORT} not ready after ${WAIT_MS / 1000}s — run "npm run stems:dev" manually if AI Lab stems fail`,
    );
  }
}

async function main() {
  if (await isPortOpen(PORT)) {
    if (await proxyHealthy()) {
      console.log(`[stems:dev] already running (:${PORT})`);
      return;
    }
    await startProxy(`stale proxy on :${PORT} — restarting`);
    return;
  }
  await startProxy('starting stem dev-proxy…');
}

main().catch(err => {
  console.error('[stems:dev]', err);
  process.exit(1);
});
