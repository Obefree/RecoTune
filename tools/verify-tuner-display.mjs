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
const NOTE_CONFIRM_FRAMES = 5;
const NOTE_CONFIRM_CENTS = 25;
const NOTE_MIN_HOLD_MS = 80;
const NOTE_SWITCH_OFFSET_CENTS = 35;
const MAX_CENTS_PER_SEC = 140;
const HZ_DISPLAY_EMA = 0.28;
const CHART_MIDI_EMA = 0.25;
const OUTLIER_CENTS_JUMP = 200;
const OUTLIER_HOLD_FRAMES = 2;

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
    this.chartMidiDisplay = null;
    this.candidateMidi = null;
    this.candidateFrames = 0;
    this.candidateStartTs = null;
    this.lastTs = null;
    this.lastRawMidi = null;
    this.outlierHoldFrames = 0;
    this.heldTargetCents = 0;
  }

  process(rawHz, ts = Date.now()) {
    if (!Number.isFinite(rawHz) || rawHz < 55) return null;
    const dtMs = this.lastTs == null ? 55 : Math.min(120, Math.max(16, ts - this.lastTs));
    this.lastTs = ts;
    const rawMidi = freqToMidi(rawHz);
    const nearestMidi = Math.round(rawMidi);

    if (this.lastRawMidi != null) {
      const jumpCents = Math.abs((rawMidi - this.lastRawMidi) * 100);
      if (jumpCents > OUTLIER_CENTS_JUMP) this.outlierHoldFrames = OUTLIER_HOLD_FRAMES;
    }
    this.lastRawMidi = rawMidi;
    const outlierHold = this.outlierHoldFrames > 0;
    if (outlierHold) this.outlierHoldFrames -= 1;

    if (this.lockedMidi == null) {
      this.lockedMidi = nearestMidi;
      this.displayCents = (rawMidi - nearestMidi) * 100;
      this.heldTargetCents = this.displayCents;
    } else if (!outlierHold) {
      this.updateLockedNote(rawMidi, nearestMidi, ts);
    }

    const locked = this.lockedMidi;
    const measuredTarget = Math.max(-50, Math.min(50, (rawMidi - locked) * 100));
    if (!outlierHold) this.heldTargetCents = measuredTarget;

    this.displayCents = stepTowardTarget(
      this.displayCents,
      this.heldTargetCents,
      (MAX_CENTS_PER_SEC * dtMs) / 1000,
    );

    this.hzDisplay =
      this.hzDisplay == null ? rawHz : HZ_DISPLAY_EMA * rawHz + (1 - HZ_DISPLAY_EMA) * this.hzDisplay;

    const instantChartMidi = locked + this.displayCents / 100;
    this.chartMidiDisplay =
      this.chartMidiDisplay == null
        ? instantChartMidi
        : CHART_MIDI_EMA * instantChartMidi + (1 - CHART_MIDI_EMA) * this.chartMidiDisplay;

    return {
      lockedMidi: locked,
      cents: Math.round(this.displayCents),
      displayCents: this.displayCents,
      chartDisplayMidi: this.chartMidiDisplay,
    };
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

assert(stepTowardTarget(0, 10, 4) === 4, 'step cap');
assert(stepTowardTarget(8, 10, 4) === 10, 'reaches target');
assert(stepTowardTarget(10, 3, 2) === 8, 'no overshoot down');

const d = new TunerPitchDisplay();
let t = 0;
const a4 = 440;
let r = d.process(a4, (t += 55));
assert(r.lockedMidi === 69, 'locks A4');

for (let i = 0; i < 8; i++) d.process(a4 * 1.02, (t += 55));
assert(d.lockedMidi === 69, 'brief sharp bend keeps A until confirmed');

const b4 = 493.88;
for (let i = 0; i < NOTE_CONFIRM_FRAMES + 4; i++) d.process(b4, (t += 55));
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

d.reset();
t = 0;
d.process(a4, (t += 55));
const before = d.displayCents;
d.process(880, (t += 55));
assert(Math.abs(d.displayCents - before) < 12, 'outlier octave spike barely moves needle');

console.log('verify-tuner-display: OK');
