/**
 * Smoke: tuner display hysteresis + no run-ahead lerp.
 * Run: node tools/verify-tuner-display.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function stepTowardTarget(current, target, maxStep) {
  const delta = target - current;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

const A4 = 440;
const A4_MIDI = 69;
const NOTE_CONFIRM_FRAMES = 2;
const NOTE_SWITCH_OFFSET_CENTS = 38;
const MAX_CENTS_PER_SEC = 400;
const HZ_DISPLAY_EMA = 0.42;

function freqToMidi(freq) {
  return 12 * Math.log2(freq / A4) + A4_MIDI;
}

class TunerPitchDisplay {
  constructor() {
    this.reset();
  }

  reset() {
    this.lockedMidi = null;
    this.displayCents = 0;
    this.hzDisplay = null;
    this.candidateMidi = null;
    this.candidateFrames = 0;
    this.lastTs = null;
  }

  process(rawHz, ts = Date.now()) {
    if (!Number.isFinite(rawHz) || rawHz < 55) return null;
    const dtMs = this.lastTs == null ? 55 : Math.min(120, Math.max(16, ts - this.lastTs));
    this.lastTs = ts;
    const rawMidi = freqToMidi(rawHz);
    const nearestMidi = Math.round(rawMidi);
    if (this.lockedMidi == null) {
      this.lockedMidi = nearestMidi;
      this.displayCents = (rawMidi - nearestMidi) * 100;
    } else {
      this.updateLockedNote(rawMidi, nearestMidi);
    }
    const locked = this.lockedMidi;
    const targetCents = Math.max(-50, Math.min(50, (rawMidi - locked) * 100));
    this.displayCents = stepTowardTarget(
      this.displayCents,
      targetCents,
      (MAX_CENTS_PER_SEC * dtMs) / 1000,
    );
    this.hzDisplay =
      this.hzDisplay == null ? rawHz : HZ_DISPLAY_EMA * rawHz + (1 - HZ_DISPLAY_EMA) * this.hzDisplay;
    return { lockedMidi: locked, cents: Math.round(this.displayCents), displayCents: this.displayCents };
  }

  updateLockedNote(rawMidi, nearestMidi) {
    const locked = this.lockedMidi;
    const offsetFromLocked = (rawMidi - locked) * 100;
    if (nearestMidi === locked) {
      this.candidateMidi = null;
      this.candidateFrames = 0;
      return;
    }
    const towardNeighbor =
      Math.abs(offsetFromLocked) >= NOTE_SWITCH_OFFSET_CENTS &&
      Math.sign(offsetFromLocked) === Math.sign(nearestMidi - locked);
    if (!towardNeighbor) {
      this.candidateMidi = null;
      this.candidateFrames = 0;
      return;
    }
    if (this.candidateMidi === nearestMidi) this.candidateFrames += 1;
    else {
      this.candidateMidi = nearestMidi;
      this.candidateFrames = 1;
    }
    if (this.candidateFrames >= NOTE_CONFIRM_FRAMES) {
      this.lockedMidi = nearestMidi;
      this.displayCents = (rawMidi - nearestMidi) * 100;
      this.candidateMidi = null;
      this.candidateFrames = 0;
    }
  }
}

assert(stepTowardTarget(0, 10, 4) === 4, 'step cap');
assert(stepTowardTarget(8, 10, 4) === 10, 'reaches target');
assert(stepTowardTarget(10, 3, 2) === 8, 'no overshoot down');

const d = new TunerPitchDisplay();
let t = 0;
const a4 = 440;
let r = d.process(a4, (t += 55));
assert(r.lockedMidi === 69, 'locks A4');

for (let i = 0; i < 6; i++) d.process(a4 * 1.02, (t += 55));
assert(d.lockedMidi === 69, 'brief sharp bend keeps A until confirmed');

const b4 = 493.88;
for (let i = 0; i < NOTE_CONFIRM_FRAMES + 2; i++) d.process(b4, (t += 55));
assert(d.lockedMidi === 71, 'switches to B after sustained new pitch');

let maxLead = 0;
d.reset();
t = 0;
for (let i = 0; i < 12; i++) {
  const raw = a4 + (i / 11) * (b4 - a4);
  const rawMidi = freqToMidi(raw);
  const target = Math.max(-50, Math.min(50, (rawMidi - d.lockedMidi) * 100));
  const out = d.process(raw, (t += 55));
  const lead = out.displayCents - target;
  if (lead > maxLead) maxLead = lead;
}
assert(maxLead < 0.5, `display should not run ahead of target (maxLead=${maxLead})`);

console.log('verify-tuner-display: OK');
