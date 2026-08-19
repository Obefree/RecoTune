/**
 * Smoke checks for melody contour transcription (frame → note) gating.
 * Mirrors src/utils/melodyTranscription.ts + src/utils/pitchFrame.ts.
 * Guards the fix for "frequencies reach the detector but notes are not recognized":
 *   - frame range matches the engine (70–1200 Hz), nothing dropped at the gate;
 *   - repeated same-pitch notes split on an energy re-attack (C-C-C);
 *   - a held note stays a single note;
 *   - genuine short notes survive, 1-frame glitches do not.
 * Run: node tools/verify-melody-transcription.mjs
 */

const RING = { freqMin: 70, freqMax: 1200 };
const T = {
  minRms: 0.005,
  maxYin: 0.28,
  pitchJumpSemitones: 0.72,
  transitionConfirmFrames: 2,
  immediateLeapSemitones: 1.5,
  minSegmentMs: 70,
  silenceGapMs: 220,
  voicedBridgeGapMs: 130,
  mergeSameMidiGapMs: 80,
  mergeSameMidiMaxCents: 55,
  shortFragmentMs: 90,
  shortFragmentFrames: 1,
  shortFragmentMaxSemitones: 1.05,
  onsetPeakDecay: 0.9,
  onsetReleaseRatio: 0.62,
  onsetAttackRatio: 0.9,
  onsetMinRepeatMs: 90,
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function median(nums) {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function freqToMidi(freq) {
  return 12 * Math.log2(freq / 440) + 69;
}

/** {t, freq, rms, yin} → PitchFrame-like */
function frame(t, freq, rms, yin = 0.05) {
  const f = freq && freq >= 55 ? freq : null;
  return { t, freq: f, midi: f != null ? freqToMidi(f) : null, rms, yinConfidence: yin };
}

function isVoiced(f) {
  if (f.freq == null || f.midi == null) return false;
  if (f.freq < RING.freqMin || f.freq > RING.freqMax) return false;
  if (f.rms < T.minRms) return false;
  if (f.yinConfidence != null && f.yinConfidence > T.maxYin) return false;
  return true;
}

function segMed(frames) {
  return median(frames.map(f => f.midi));
}

function smooth(voiced) {
  if (voiced.length < 3) return voiced;
  return voiced.map((f, i) => {
    const win = voiced.slice(Math.max(0, i - 1), Math.min(voiced.length, i + 2)).map(x => x.midi);
    const med = median(win);
    if (Math.abs(f.midi - med) >= T.pitchJumpSemitones) return f;
    return { ...f, midi: med };
  });
}

function confirmedPitchMove(voiced, index, curMed) {
  const leap = Math.abs(voiced[index].midi - curMed);
  if (leap >= T.immediateLeapSemitones) return true;
  const frames = [];
  for (let i = index; i < voiced.length && frames.length < T.transitionConfirmFrames; i++) {
    if (i > index && voiced[i].t - voiced[i - 1].t >= T.silenceGapMs) break;
    frames.push(voiced[i]);
  }
  if (frames.length < T.transitionConfirmFrames) return false;
  return Math.abs(segMed(frames) - curMed) >= T.pitchJumpSemitones;
}

function split(voiced) {
  if (voiced.length === 0) return [];
  const out = [];
  let cur = [voiced[0]];
  let onset = false;
  let peak = voiced[0].rms;
  let released = false;
  for (let i = 1; i < voiced.length; i++) {
    const prev = voiced[i - 1];
    const f = voiced[i];
    const gap = f.t - prev.t;
    const med = segMed(cur);
    const jump = Math.abs(f.midi - med);
    peak = Math.max(f.rms, peak * T.onsetPeakDecay);
    if (f.rms < peak * T.onsetReleaseRatio) released = true;
    if (gap >= T.silenceGapMs) {
      out.push({ frames: cur, onsetStart: onset });
      cur = [f]; onset = false; peak = f.rms; released = false; continue;
    }
    if (jump >= T.pitchJumpSemitones && confirmedPitchMove(voiced, i, med)) {
      out.push({ frames: cur, onsetStart: onset });
      cur = [f]; onset = false; peak = f.rms; released = false; continue;
    }
    const segDur = f.t - cur[0].t;
    const reAttack = released && jump < T.pitchJumpSemitones
      && f.rms > peak * T.onsetAttackRatio && f.rms > prev.rms && segDur >= T.onsetMinRepeatMs;
    if (reAttack) {
      out.push({ frames: cur, onsetStart: onset });
      cur = [f]; onset = true; peak = f.rms; released = false; continue;
    }
    cur.push(f);
  }
  if (cur.length) out.push({ frames: cur, onsetStart: onset });
  return out;
}

function mergeSameMidi(raw) {
  if (raw.length <= 1) return raw;
  const out = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const prev = out[out.length - 1];
    const cur = raw[i];
    const pm = segMed(prev.frames);
    const cm = segMed(cur.frames);
    const gap = cur.frames[0].t - prev.frames[prev.frames.length - 1].t;
    const cents = Math.abs((cm - pm) * 100);
    if (Math.round(pm) === Math.round(cm) && !cur.onsetStart
      && gap < T.mergeSameMidiGapMs && cents < T.mergeSameMidiMaxCents) {
      out[out.length - 1] = { frames: [...prev.frames, ...cur.frames], onsetStart: prev.onsetStart };
    } else {
      out.push(cur);
    }
  }
  return out;
}

function absorbShort(raw) {
  if (raw.length <= 1) return raw;
  const out = [];
  let i = 0;
  while (i < raw.length) {
    const cur = raw[i];
    const cm = segMed(cur.frames);
    const dur = cur.frames[cur.frames.length - 1].t - cur.frames[0].t;
    const isShort = dur < T.shortFragmentMs && cur.frames.length <= T.shortFragmentFrames;
    if (!isShort) { out.push(cur); i++; continue; }
    const prev = out[out.length - 1];
    const next = raw[i + 1];
    const pm = prev ? segMed(prev.frames) : null;
    const nm = next ? segMed(next.frames) : null;
    if (cur.onsetStart && pm != null && Math.round(pm) === Math.round(cm)) { out.push(cur); i++; continue; }
    if (prev && next && pm != null && nm != null && Math.round(pm) === Math.round(nm)
      && Math.abs(cm - pm) <= T.shortFragmentMaxSemitones) {
      out[out.length - 1] = { frames: [...prev.frames, ...cur.frames, ...next.frames], onsetStart: prev.onsetStart };
      i += 2; continue;
    }
    const pd = pm == null ? Infinity : Math.abs(cm - pm);
    const nd = nm == null ? Infinity : Math.abs(cm - nm);
    const cp = prev != null && pd <= T.shortFragmentMaxSemitones;
    const cn = next != null && nd <= T.shortFragmentMaxSemitones;
    if (cp && (!cn || pd <= nd)) { out[out.length - 1] = { frames: [...prev.frames, ...cur.frames], onsetStart: prev.onsetStart }; i++; continue; }
    if (cn) { out.push({ frames: [...cur.frames, ...next.frames], onsetStart: cur.onsetStart }); i += 2; continue; }
    out.push(cur); i++;
  }
  return out;
}

function transcribe(frames) {
  const voiced = smooth(frames.filter(isVoiced));
  if (voiced.length === 0) return [];
  const raw = mergeSameMidi(absorbShort(mergeSameMidi(split(voiced))));
  return raw
    .filter(r => r.frames.length >= 2)
    .map(r => Math.round(segMed(r.frames)));
}

/** Build N frames of a held pitch at constant loudness from t0. */
function held(t0, freq, n, rms = 0.5, step = 55) {
  return Array.from({ length: n }, (_, i) => frame(t0 + i * step, freq, rms));
}

// 1) Range — engine emits 70–1200 Hz; the gate must accept what the detector returns.
assert(isVoiced(frame(0, 1100, 0.4)), 'high note 1100 Hz must be voiced (range matches engine)');
assert(isVoiced(frame(0, 75, 0.4)), 'low note 75 Hz must be voiced (range matches engine)');
assert(!isVoiced(frame(0, 1300, 0.4)), '1300 Hz is above the engine range');
assert(!isVoiced(frame(0, 60, 0.4)), '60 Hz is below the engine range');

// 2) Repeated same-pitch note (A4) with an amplitude dip + re-attack → two notes.
const repeat = [
  ...held(0, 440, 3, 0.5),
  frame(165, 440, 0.22),          // release (dip)
  ...held(220, 440, 3, 0.55),     // re-attack
];
const repeatNotes = transcribe(repeat);
assert(repeatNotes.length === 2, `repeated A4 should split into 2 notes, got ${repeatNotes.length}`);
assert(repeatNotes.every(m => m === 69), 'both repeated notes should be A4 (midi 69)');

// 3) Held note (no dip) stays a single note — no phantom repeats.
const heldNotes = transcribe(held(0, 440, 7, 0.5));
assert(heldNotes.length === 1, `held A4 should be a single note, got ${heldNotes.length}`);

// 4) Fast melodic run C4 → E4 (short) → G4 — the middle short note survives.
const run = [
  ...held(0, 262, 3, 0.5),
  ...held(165, 330, 2, 0.5),
  ...held(275, 392, 3, 0.5),
];
const runNotes = transcribe(run);
assert(runNotes.length === 3, `C-E-G run should keep all 3 notes, got ${runNotes.length}`);

// 5) A 1-frame outlier is a glitch, not a note.
const glitch = [
  ...held(0, 262, 4, 0.5),
  frame(220, 740, 0.5),           // single wild F#5 frame
  ...held(275, 262, 4, 0.5),
];
const glitchNotes = transcribe(glitch);
assert(!glitchNotes.includes(Math.round(freqToMidi(740))), '1-frame outlier must not become a note');

// 6) Distinct short note between two same-pitch notes (A4 · C5 · A4) must survive —
//    a real different note must not be absorbed/merged into one.
const sandwich = [
  ...held(0, 440, 3, 0.5),        // A4
  ...held(165, 523, 2, 0.5),      // C5 (short, distinct)
  ...held(275, 440, 3, 0.5),      // A4
];
const sandwichNotes = transcribe(sandwich);
assert(
  sandwichNotes.includes(Math.round(freqToMidi(523))),
  `distinct short C5 between two A4 must survive, got ${JSON.stringify(sandwichNotes)}`,
);
assert(sandwichNotes.length === 3, `A4-C5-A4 should be 3 notes, got ${sandwichNotes.length}`);

// 7) Fast 8th-note scale C4 D4 E4 F4 (2 frames each) — all four survive.
const scale = [
  ...held(0, 262, 2, 0.5),
  ...held(110, 294, 2, 0.5),
  ...held(220, 330, 2, 0.5),
  ...held(330, 349, 2, 0.5),
];
const scaleNotes = transcribe(scale);
assert(scaleNotes.length === 4, `C-D-E-F 8ths should be 4 notes, got ${scaleNotes.length}`);

// 8) 2-frame passing note must survive 3-frame median (leap-preserving smooth).
const passing = [
  ...held(0, 262, 4, 0.5),
  ...held(220, 330, 2, 0.5),
  ...held(330, 392, 4, 0.5),
];
const passingNotes = transcribe(passing);
assert(passingNotes.length === 3, `C-E-G with 2-frame E must stay 3 notes, got ${passingNotes.length}`);
assert(
  passingNotes.includes(Math.round(freqToMidi(330))),
  `passing E4 must survive smoothing, got ${JSON.stringify(passingNotes)}`,
);

console.log('verify-melody-transcription: OK');
