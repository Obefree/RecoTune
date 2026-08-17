#!/usr/bin/env node
/**
 * Copy PC overlay (live parses) into assets/archive/proxy-parsed-chords.json for Vercel.
 */
import { publishLocalOverlayToSnapshot, parsedStoreStats } from './parsedChordStore.mjs';

const stats = parsedStoreStats();
const published = publishLocalOverlayToSnapshot();
console.log(`[chord-db] store songs (incl. pesni seed): ${stats.songs}`);
console.log(`[chord-db] wrote overlay snapshot: ${published.count} → ${published.path}`);
console.log('[chord-db] deploy RecoTune to Vercel so the phone can use https://…/api/fetch-chords');
