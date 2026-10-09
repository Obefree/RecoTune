/**
 * Smoke: metronome BPM clamp + beat interval.
 * Run: node tools/verify-metronome.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const METRONOME_BPM_MIN = 30;
const METRONOME_BPM_MAX = 240;
const METRONOME_BPM_DEFAULT = 80;

function clampMetronomeBpm(bpm) {
  if (!Number.isFinite(bpm)) return METRONOME_BPM_DEFAULT;
  return Math.min(METRONOME_BPM_MAX, Math.max(METRONOME_BPM_MIN, Math.round(bpm)));
}

function beatIntervalMs(bpm) {
  return 60_000 / clampMetronomeBpm(bpm);
}

assert(clampMetronomeBpm(80) === 80, '80 stays');
assert(clampMetronomeBpm(10) === 30, 'floor 30');
assert(clampMetronomeBpm(400) === 240, 'ceil 240');
assert(clampMetronomeBpm(Number.NaN) === METRONOME_BPM_DEFAULT, 'NaN default');
assert(Math.round(beatIntervalMs(120)) === 500, '120 BPM = 500 ms');
assert(Math.round(beatIntervalMs(60)) === 1000, '60 BPM = 1000 ms');
console.log('verify-metronome ok');
