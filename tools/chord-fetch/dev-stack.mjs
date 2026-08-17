#!/usr/bin/env node
/**
 * Dev stack: ultimate-api (Flask :5000) + chord-fetch proxy (:8787).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runUltimate = path.join(here, 'scripts', 'run-ultimate-api.mjs');

const env = {
  ...process.env,
  ULTIMATE_API_URL: process.env.ULTIMATE_API_URL ?? 'http://127.0.0.1:5000',
};

const children = [];

function start(label, cmd, args, cwd = here, { fatal = false } = {}) {
  const child = spawn(cmd, args, { cwd, stdio: 'inherit', env, shell: process.platform === 'win32' });
  child.on('exit', (code, signal) => {
    if (signal) console.error(`[${label}] signal ${signal}`);
    else if (code) console.error(`[${label}] exit ${code}`);
    if (fatal) shutdown(code ?? 1);
    else console.warn(`[${label}] stopped — AmDm/GitHub on :8787 still run if proxy is up`);
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const c of children) {
    try {
      c.kill();
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Starting ultimate-api + chord-fetch dev proxy…');
console.log(`ULTIMATE_API_URL=${env.ULTIMATE_API_URL}`);

start('ultimate-api', process.execPath, [runUltimate]);

setTimeout(() => {
  start('dev-proxy', process.execPath, ['dev-proxy-server.mjs'], here, { fatal: true });
}, 1500);
