/**
 * Smoke: contour PLAY uses sung start/end, does not stretch every note to 200 ms,
 * and BPM from 8th-note IOI folds to a beat tempo.
 * Run: node tools/verify-melody-playback.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ENGINE_MIN = 40;

function notesFromSegments(segments, noteGapMs = 12) {
  if (segments.length === 0) return [];
  const t0 = segments[0].startMs;
  const out = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const next = segments[i + 1];
    const hardEnd = next ? Math.min(seg.endMs, next.startMs) : seg.endMs;
    const sungDur = hardEnd - seg.startMs - (next ? noteGapMs : 0);
    let dur = Math.max(ENGINE_MIN, sungDur);
    if (next) {
      const maxDur = Math.max(ENGINE_MIN, next.startMs - seg.startMs - noteGapMs);
      dur = Math.min(dur, maxDur);
    }
    out.push({ midi: seg.midi, startMs: Math.max(0, seg.startMs - t0), durationMs: dur });
  }
  return out;
}

function foldIoIToBpm(rawBpm) {
  if (!Number.isFinite(rawBpm) || rawBpm <= 0) return rawBpm;
  let bpm = rawBpm;
  while (bpm > 184) bpm /= 2;
  while (bpm < 52) bpm *= 2;
  return Math.round(bpm);
}

const eighths = [
  { startMs: 0, endMs: 90, midi: 60 },
  { startMs: 250, endMs: 340, midi: 62 },
  { startMs: 500, endMs: 590, midi: 64 },
  { startMs: 750, endMs: 970, midi: 65 },
];
const played = notesFromSegments(eighths);
assert(played.length === 4, '4 sung notes → 4 playback notes');
assert(played[0].durationMs <= 90, `short note must keep sung duration, got ${played[0].durationMs}`);
assert(played[1].startMs === 250, `onset 2 must stay at 250ms, got ${played[1].startMs}`);
assert(played[3].startMs === 750, `last onset must stay at 750ms, got ${played[3].startMs}`);
assert(
  played.every((n, i) => i === 0 || n.startMs >= played[i - 1].startMs + played[i - 1].durationMs - 1),
  'notes must not overlap the next onset',
);

assert(foldIoIToBpm(240) === 120, '8th-note IOI 250ms → 120 BPM not 240');
assert(foldIoIToBpm(120) === 120, 'quarter IOI 500ms stays 120');
assert(foldIoIToBpm(480) === 120, '16th IOI folds to beat BPM');

console.log('verify-melody-playback: OK');
