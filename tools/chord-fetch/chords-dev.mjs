#!/usr/bin/env node
/**
 * Ensures ultimate-api (:5000) + dev-proxy (:8787) are running for local chord fetch.
 * Spawns dev-stack detached if ports are closed. Exits quickly — safe for npm start pre-hook.
 */
import net from 'node:net';
import { execSync, spawn } from 'node:child_process';
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

function killListeningPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!/LISTENING/i.test(line)) continue;
        const pid = line.trim().split(/\s+/).pop();
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        } catch {
          /* ignore */
        }
      }
      return;
    }
    execSync(`lsof -ti tcp:${port} | xargs kill -9`, { stdio: 'ignore', shell: true });
  } catch {
    /* port already free */
  }
}

/** Old dev-proxy only had POST /fetch — library search needs POST /search. */
async function proxySupportsSearch() {
  try {
    const health = await fetch(`http://127.0.0.1:${PROXY_PORT}/health`, {
      signal: AbortSignal.timeout(2500),
    });
    if (health.ok) {
      const body = await health.json();
      const hint = String(body?.hint ?? '');
      if (hint.includes('/search')) return true;
    }
    const search = await fetch(`http://127.0.0.1:${PROXY_PORT}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'ab', limit: 1 }),
      signal: AbortSignal.timeout(4000),
    });
    return search.status !== 404;
  } catch {
    return false;
  }
}

async function startDevStack(reason) {
  if (reason) console.warn(`[chords:dev] ${reason}`);
  killListeningPort(PROXY_PORT);
  killListeningPort(ULTIMATE_PORT);
  await sleep(400);

  const stack = path.join(here, 'dev-stack.mjs');
  const child = spawn(process.execPath, [stack], {
    cwd: here,
    detached: true,
    stdio: 'ignore',
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
  const searchOk = await proxySupportsSearch();
  if (!searchOk) {
    console.warn(`[chords:dev] :${PROXY_PORT} up but POST /search missing — check dev-proxy-server.mjs`);
  }
}

async function main() {
  const proxyUp = await isPortOpen(PROXY_PORT);
  const ultimateUp = await isPortOpen(ULTIMATE_PORT);

  if (proxyUp && ultimateUp) {
    if (await proxySupportsSearch()) {
      console.log(`[chords:dev] already running (:${ULTIMATE_PORT}, :${PROXY_PORT})`);
      return;
    }
    await startDevStack(`stale dev-proxy on :${PROXY_PORT} (no POST /search) — restarting`);
    return;
  }

  if (proxyUp && !ultimateUp) {
    await startDevStack(`:${PROXY_PORT} up but :${ULTIMATE_PORT} down — restarting stack`);
    return;
  }
  if (!proxyUp && ultimateUp) {
    await startDevStack(`:${ULTIMATE_PORT} up but :${PROXY_PORT} down — restarting stack`);
    return;
  }
  await startDevStack('starting dev-stack (ultimate-api + dev-proxy)…');
}

main().catch(err => {
  console.error('[chords:dev]', err);
  process.exit(1);
});
