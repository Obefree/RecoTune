#!/usr/bin/env node
/**
 * Start vendored Flask ultimate-api on Windows/macOS/Linux.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, '..', '..', 'ultimate-api');
const venvPyWin = path.join(apiRoot, 'venv', 'Scripts', 'python.exe');
const venvPyPosix = path.join(apiRoot, 'venv', 'bin', 'python');

function pickPython() {
  if (process.env.PYTHON?.trim()) return { cmd: process.env.PYTHON.trim(), args: ['run.py'] };
  if (existsSync(venvPyWin)) return { cmd: venvPyWin, args: ['run.py'] };
  if (existsSync(venvPyPosix)) return { cmd: venvPyPosix, args: ['run.py'] };
  if (process.platform === 'win32') return { cmd: 'py', args: ['-3', 'run.py'] };
  return { cmd: 'python3', args: ['run.py'] };
}

const { cmd, args } = pickPython();
const child = spawn(cmd, args, {
  cwd: apiRoot,
  stdio: 'inherit',
  env: { ...process.env },
});

child.on('exit', code => process.exit(code ?? 1));
