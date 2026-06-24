/**
 * Smoke: tuner display — 1€ smoothing (stable hold + fast track, no run-ahead),
 * note hysteresis, confidence gate, octave-glitch rejection.
 * Run: node tools/verify-tuner-display.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const A4 = 440;
const A4_MIDI = 69;
const NOTE_CONFIRM_FRAMES = 4;
const NOTE_CONFIRM_CENTS = 28;
const NOTE_MIN_HOLD_MS = 70;
const NOTE_SWITCH_OFFSET_CENTS = 33;
const HZ_DISPLAY_EMA = 0.25;
const CHART_MIDI_EMA = 0.3;
const OUTLIER_CENTS_JUMP = 200;
const EURO_MIN_CUTOFF = 0.6;
const EURO_BETA = 0.9;
const EURO_D_CUTOFF = 1.0;
const CONFIDENCE_MAX_YIN = 0.18;

function freqToMidi(freq) {
  return 12 * Math.log2(freq / A4) + A4_MIDI;
}

function alpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

class OneEuroFilter {
  constructor(minCutoff = EURO_MIN_CUTOFF, beta = EURO_BETA, dCutoff = EURO_D_CUTOFF) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }
  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
  }
  filter(x, dtSec) {
    if (this.xPrev == null) {
      this.xPrev = x;
      this.dxPrev = 0;
      return x;
    }
    const dt = dtSec > 0 ? dtSec : 0.055;
    const dx = (x - this.xPrev) / dt;
    const edx = this.dxPrev + alpha(this.dCutoff, dt) * (dx - this.dxPrev);
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const xHat = this.xPrev + alpha(cutoff, dt) * (x - this.xPrev);
    this.xPrev = xHat;
    this.dxPrev = edx;
    return xHat;
  }
}

class TunerPitchDisplay {
  constructor() {
    this.euro = new OneEuroFilter();
    this.reset();
  }
  reset() {
    this.lockedMidi = null;
    this.smoothMidi = null;
    this.displayCents = 0;
    this.hzDisplay = null;
    this.chartMidiDisplay = null;
    this.candidateMidi = null;
    this.candidateFrames = 0;
    this.candidateStartTs = null;
    this.lastTs = null;
    this.lastRawMidi = null;
    this.euro.reset();
  }
  snapshot() {
    return {
      lockedMidi: this.lockedMidi,
      cents: Math.round(this.displayCents),
      displayCents: this.displayCents,
      chartDisplayMidi: this.chartMidiDisplay ?? this.lockedMidi,
    };
  }
  process(rawHz, ts = Date.now(), yinConfidence) {
    if (!Number.isFinite(rawHz) || rawHz < 28) return null;
    if (yinConfidence != null && yinConfidence > CONFIDENCE_MAX_YIN) {
      return this.lockedMidi == null ? null : this.snapshot();
    }
    const dtMs = this.lastTs == null ? 55 : Math.min(160, Math.max(16, ts - this.lastTs));
    this.lastTs = ts;
    const dtSec = dtMs / 1000;
    const rawMidi = freqToMidi(rawHz);
    if (this.lastRawMidi != null) {
      const jumpCents = Math.abs((rawMidi - this.lastRawMidi) * 100);
      if (jumpCents > OUTLIER_CENTS_JUMP) {
        this.lastRawMidi = rawMidi;
        return this.lockedMidi == null ? null : this.snapshot();
      }
    }
    this.lastRawMidi = rawMidi;
    const nearestMidi = Math.round(rawMidi);
    this.smoothMidi = this.euro.filter(rawMidi, dtSec);
    if (this.lockedMidi == null) this.lockedMidi = nearestMidi;
    else this.updateLockedNote(rawMidi, nearestMidi, ts);
    const locked = this.lockedMidi;
    this.displayCents = Math.max(-50, Math.min(50, (this.smoothMidi - locked) * 100));
    this.hzDisplay =
      this.hzDisplay == null ? rawHz : HZ_DISPLAY_EMA * rawHz + (1 - HZ_DISPLAY_EMA) * this.hzDisplay;
    this.chartMidiDisplay =
      this.chartMidiDisplay == null
        ? this.smoothMidi
        : CHART_MIDI_EMA * this.smoothMidi + (1 - CHART_MIDI_EMA) * this.chartMidiDisplay;
    return this.snapshot();
  }
  updateLockedNote(rawMidi, nearestMidi, ts) {
    const locked = this.lockedMidi;
    const offsetFromLocked = (rawMidi - locked) * 100;
    const centsOnCandidate = (rawMidi - nearestMidi) * 100;
    if (nearestMidi === locked) {
      this.candidateMidi = null;
      this.candidateFrames = 0;
      this.candidateStartTs = null;
      return;
    }
    const towardNeighbor =
      Math.abs(offsetFromLocked) >= NOTE_SWITCH_OFFSET_CENTS &&
      Math.sign(offsetFromLocked) === Math.sign(nearestMidi - locked);
    if (!towardNeighbor || Math.abs(centsOnCandidate) > NOTE_CONFIRM_CENTS) {
      this.candidateMidi = null;
      this.candidateFrames = 0;
      this.candidateStartTs = null;
      return;
    }
    if (this.candidateMidi === nearestMidi) this.candidateFrames += 1;
    else {
      this.candidateMidi = nearestMidi;
      this.candidateFrames = 1;
      this.candidateStartTs = ts;
    }
    const holdMs = this.candidateStartTs == null ? 0 : ts - this.candidateStartTs;
    if (this.candidateFrames >= NOTE_CONFIRM_FRAMES && holdMs >= NOTE_MIN_HOLD_MS) {
      this.lockedMidi = nearestMidi;
      this.candidateMidi = null;
      this.candidateFrames = 0;
      this.candidateStartTs = null;
    }
  }
}

// 1€ low-pass never overshoots a monotonic ramp (no run-ahead).
{
  const euro = new OneEuroFilter();
  let prev = euro.filter(0, 0.055);
  let maxLead = 0;
  for (let i = 1; i <= 20; i++) {
    const x = i * 0.05; // rising target in semitones
    const y = euro.filter(x, 0.055);
    if (y - x > maxLead) maxLead = y - x;
    assert(y >= prev - 1e-9, 'monotonic input → monotonic output');
    prev = y;
  }
  assert(maxLead < 1e-6, `1€ never runs ahead of ramp (maxLead=${maxLead})`);
}

const d = new TunerPitchDisplay();
let t = 0;
const a4 = 440;
let r = d.process(a4, (t += 55));
assert(r.lockedMidi === 69, 'locks A4');

// Steady tone → needle settles near 0 and stays stable (low jitter).
for (let i = 0; i < 30; i++) d.process(a4, (t += 55));
assert(Math.abs(d.displayCents) < 2, `steady A4 sits at center (${d.displayCents})`);
let jitter = 0;
let last = d.displayCents;
for (let i = 0; i < 20; i++) {
  d.process(a4 * (1 + (i % 2 ? 0.0008 : -0.0008)), (t += 55)); // tiny mic noise ±1.4¢
  jitter = Math.max(jitter, Math.abs(d.displayCents - last));
  last = d.displayCents;
}
assert(jitter < 3, `held note has low needle jitter under mic noise (${jitter.toFixed(2)}¢)`);

// Brief sharp bend keeps the note until sustained.
d.reset();
t = 0;
d.process(a4, (t += 55));
for (let i = 0; i < 3; i++) d.process(a4 * 1.02, (t += 55));
assert(d.lockedMidi === 69, 'brief sharp bend keeps A until confirmed');

// Sustained new pitch switches the note.
const b4 = 493.88;
for (let i = 0; i < NOTE_CONFIRM_FRAMES + 6; i++) d.process(b4, (t += 55));
assert(d.lockedMidi === 71, 'switches to B after sustained new pitch');

// Real pitch change is tracked within a few hundred ms (responsive).
d.reset();
t = 0;
for (let i = 0; i < 5; i++) d.process(a4, (t += 55)); // settle on A4
const sharpTarget = a4 * 2 ** (0.25 / 12); // +25¢
for (let i = 0; i < 6; i++) d.process(sharpTarget, (t += 55)); // ~330 ms
assert(d.displayCents > 18, `needle reaches a real +25¢ change within ~330ms (${d.displayCents.toFixed(1)})`);

// Octave glitch barely moves the needle.
d.reset();
t = 0;
d.process(a4, (t += 55));
for (let i = 0; i < 4; i++) d.process(a4, (t += 55));
const before = d.displayCents;
d.process(880, (t += 55));
assert(Math.abs(d.displayCents - before) < 6, 'octave glitch frame held, needle barely moves');

// Low-confidence frames are ignored (held), not chased.
d.reset();
t = 0;
for (let i = 0; i < 5; i++) d.process(a4, (t += 55));
const heldCents = d.displayCents;
const out = d.process(a4 * 1.05, (t += 55), 0.5); // junk frame, low confidence
assert(out && Math.abs(out.displayCents - heldCents) < 0.001, 'low-confidence frame holds reading');

console.log('verify-tuner-display: OK');
