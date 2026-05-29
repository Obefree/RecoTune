#!/usr/bin/env node
import assert from 'node:assert/strict';

// Mirror of src/utils/chordTranspose.ts for CI-less smoke (run: node tools/verify-chord-transpose.mjs)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = { Db: 1, Eb: 3, Gb: 6, Ab: 8, Bb: 10 };

function parseRoot(s) {
  const raw = s.replace(/♯/g, '#').replace(/♭/g, 'b').trim();
  for (let len = 2; len >= 1; len--) {
    const c = raw.slice(0, len);
    const i = NOTE_NAMES.indexOf(c);
    if (i >= 0) return { i, rest: raw.slice(len) };
    if (FLAT[c] != null) return { i: FLAT[c], rest: raw.slice(len) };
  }
  return null;
}

function transposeChordSymbol(symbol, semi) {
  if (!semi) return symbol;
  const slash = symbol.indexOf('/');
  if (slash >= 0) {
    return `${transposeChordSymbol(symbol.slice(0, slash), semi)}/${transposeChordSymbol(symbol.slice(slash + 1), semi)}`;
  }
  const p = parseRoot(symbol);
  if (!p) return symbol;
  return NOTE_NAMES[((p.i + semi) % 12 + 12) % 12] + p.rest;
}

function transposeChordProText(text, semi) {
  if (!semi) return text;
  return text.replace(/\[([^\]]+)\]/g, (full, ch) => {
    const inner = String(ch).trim();
    return /^[A-G]/i.test(inner) ? `[${transposeChordSymbol(inner, semi)}]` : full;
  });
}

assert.equal(transposeChordSymbol('Am', 2), 'Bm');
assert.equal(transposeChordSymbol('F/A', 1), 'F#/A#');
assert.equal(transposeChordProText('[Am]Hello [F]world', 2), '[Bm]Hello [G]world');
console.log('verify-chord-transpose: ok');
