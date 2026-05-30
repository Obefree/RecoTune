/**
 * Smoke checks for pitch chart stabilizer profiles (inline mirror — no TS build).
 * Run: node tools/verify-pitch-chart-history.mjs
 */

const MELODY = {
  jumpRatio: 1.26,
  jumpBlend: 0.42,
  emaAlpha: 0.22,
  maxCentsStep: 32,
  ringSize: 7,
};
const TUNER = {
  jumpRatio: 1.32,
  jumpBlend: 0.55,
  emaAlpha: 0.38,
  maxCentsStep: 48,
  ringSize: 3,
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function isTunerVoicedFrame(frame) {
  return frame.freq != null && frame.freq >= 55 && frame.rms >= 0.0025;
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function freqToMidi(freq) {
  return 12 * Math.log2(freq / 440) + 69;
}

function clampCentsStep(prevHz, nextHz, maxCentsStep) {
  const prevMidi = freqToMidi(prevHz);
  const maxSemi = maxCentsStep / 100;
  const lo = prevMidi - maxSemi;
  const hi = prevMidi + maxSemi;
  const clampedMidi = Math.min(Math.max(freqToMidi(nextHz), lo), hi);
  return 440 * 2 ** ((clampedMidi - 69) / 12);
}

class ChartFreqStabilizer {
  constructor(cfg) {
    this.cfg = cfg;
    this.ring = [];
    this.lastStable = null;
    this.display = null;
  }

  process(rawHz) {
    const { jumpRatio, jumpBlend, emaAlpha, maxCentsStep, ringSize } = this.cfg;
    if (!Number.isFinite(rawHz) || rawHz < 55) return this.display;

    this.ring.push(rawHz);
    if (this.ring.length > ringSize) this.ring.shift();

    let m = this.ring.length >= 3 ? median(this.ring) : rawHz;
    if (this.lastStable != null) {
      const lo = this.lastStable / jumpRatio;
      const hi = this.lastStable * jumpRatio;
      if (m < lo || m > hi) m = jumpBlend * m + (1 - jumpBlend) * this.lastStable;
    }
    this.lastStable = m;

    const prevDisplay = this.display;
    let next = prevDisplay == null ? m : emaAlpha * m + (1 - emaAlpha) * prevDisplay;
    if (prevDisplay != null) next = clampCentsStep(prevDisplay, next, maxCentsStep);
    this.display = next;
    return next;
  }
}

assert(
  isTunerVoicedFrame({ freq: 220, rms: 0.003 }),
  'tuner gate should accept quiet voiced frame',
);
assert(!isTunerVoicedFrame({ freq: 220, rms: 0.001 }), 'tuner gate should reject near-silence');

const melody = new ChartFreqStabilizer(MELODY);
const tuner = new ChartFreqStabilizer(TUNER);

let m = melody.process(440);
for (let i = 0; i < 8; i++) m = melody.process(440 + (i % 2) * 6);
const melodyLag = Math.abs(m - 452);

let t = tuner.process(440);
for (let i = 0; i < 8; i++) t = tuner.process(440 + (i % 2) * 6);
const tunerLag = Math.abs(t - 452);

assert(tunerLag < melodyLag, `tuner stabilizer should track faster (tuner=${tunerLag}, melody=${melodyLag})`);
assert(MELODY.ringSize > TUNER.ringSize, 'melody ring >= tuner');
assert(MELODY.emaAlpha < TUNER.emaAlpha, 'melody EMA slower than tuner chart');

melody.display = null;
melody.ring = [];
melody.lastStable = null;
melody.process(330);
const held = melody.process(NaN);
assert(held != null && held > 300, 'melody stabilizer holds display on dropout');

console.log('verify-pitch-chart-history: OK');
