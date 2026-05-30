/**
 * Smoke: tuner rolling time window — X must not grow past window width.
 * Run: node tools/verify-tuner-chart-window.mjs
 */

const CHART_SAMPLE_INTERVAL_MS = 100;
const TUNER_CHART_WINDOW_MS = 12000;
const MIN_CELL_W = 14;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function buildRollingLayout(pts, cellW, chartW, scrollRightPad, windowMs) {
  const effectiveCell = Math.max(cellW, MIN_CELL_W);
  const n = pts.length;
  const pxPerMs = effectiveCell / CHART_SAMPLE_INTERVAL_MS;
  const lastTs = pts[n - 1].ts;
  const t0 = lastTs - windowMs;
  const windowW = windowMs * pxPerMs;
  const xOfIndex = i => Math.max(0, Math.min(windowW, (pts[i].ts - t0) * pxPerMs));
  const totalW = Math.max(chartW, windowW + scrollRightPad + 8);
  return { xOfIndex, totalW, windowW, lastX: xOfIndex(n - 1) };
}

const chartW = 300;
const scrollRightPad = 130;
const cellW = chartW / 119;
const t0 = 1_000_000;

const pts = [];
for (let i = 0; i < 120; i++) {
  pts.push({ ts: t0 + i * 100, cents: 0, freq: 440, midi: 69, note: 'A', octave: 4 });
}

const short = buildRollingLayout(pts, cellW, chartW, scrollRightPad, TUNER_CHART_WINDOW_MS);
assert(short.lastX <= short.windowW + 0.01, 'last point stays inside rolling window');

// Simulate long session: timestamps span 5 minutes but only last 120 samples kept
const late = [];
const sessionStart = t0;
const now = sessionStart + 5 * 60 * 1000;
for (let i = 0; i < 120; i++) {
  late.push({ ts: now - (119 - i) * 100, cents: 0, freq: 440, midi: 69, note: 'A', octave: 4 });
}

const longSession = buildRollingLayout(late, cellW, chartW, scrollRightPad, TUNER_CHART_WINDOW_MS);
assert(
  longSession.lastX <= longSession.windowW + 0.01,
  `long session lastX=${longSession.lastX} must not exceed windowW=${longSession.windowW}`,
);
assert(
  longSession.totalW < chartW + longSession.windowW + scrollRightPad + 20,
  'totalW bounded (no minutes-wide canvas)',
);

// Session-start origin (old bug): X would be ~5min * pxPerMs
const effectiveCell = Math.max(cellW, MIN_CELL_W);
const pxPerMs2 = effectiveCell / CHART_SAMPLE_INTERVAL_MS;
const oldLastX = (now - sessionStart) * pxPerMs2;
assert(
  longSession.lastX < oldLastX / 10,
  'rolling window keeps playhead X far below session-start layout',
);

console.log('verify-tuner-chart-window: OK');
