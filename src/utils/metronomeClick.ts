export const METRONOME_BPM_MIN = 30;
export const METRONOME_BPM_MAX = 240;
export const METRONOME_BPM_DEFAULT = 80;

export function clampMetronomeBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return METRONOME_BPM_DEFAULT;
  return Math.min(METRONOME_BPM_MAX, Math.max(METRONOME_BPM_MIN, Math.round(bpm)));
}

export function beatIntervalMs(bpm: number): number {
  return 60_000 / clampMetronomeBpm(bpm);
}
