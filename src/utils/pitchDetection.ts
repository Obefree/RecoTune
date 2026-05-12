/**
 * Pitch detection via YIN algorithm (simplified).
 * Accepts Float32Array of audio samples and sample rate.
 * Returns detected frequency in Hz, or null if no clear pitch found.
 */

const YIN_THRESHOLD = 0.15;
const MIN_FREQ = 60;   // Hz - below lowest guitar string
const MAX_FREQ = 1400; // Hz - above highest guitar note

export function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  const minPeriod = Math.floor(sampleRate / MAX_FREQ);
  const maxPeriod = Math.floor(sampleRate / MIN_FREQ);
  const bufferSize = Math.min(samples.length, 2048);

  if (bufferSize < maxPeriod * 2) return null;

  // YIN difference function
  const yinBuffer = new Float32Array(maxPeriod);
  yinBuffer[0] = 1;

  let runningSum = 0;
  for (let tau = 1; tau < maxPeriod; tau++) {
    let sum = 0;
    for (let i = 0; i < bufferSize - maxPeriod; i++) {
      const delta = samples[i] - samples[i + tau];
      sum += delta * delta;
    }
    runningSum += sum;
    yinBuffer[tau] = sum * tau / (runningSum || 1e-10);
  }

  // Find first dip below threshold
  let tau = minPeriod;
  while (tau < maxPeriod) {
    if (yinBuffer[tau] < YIN_THRESHOLD) {
      // Parabolic interpolation for accuracy
      const betterTau = parabolicInterpolation(yinBuffer, tau, maxPeriod);
      const freq = sampleRate / betterTau;
      if (freq >= MIN_FREQ && freq <= MAX_FREQ) return freq;
      break;
    }
    tau++;
  }

  return null;
}

function parabolicInterpolation(buffer: Float32Array, tau: number, maxPeriod: number): number {
  if (tau <= 0 || tau >= maxPeriod - 1) return tau;
  const s0 = buffer[tau - 1];
  const s1 = buffer[tau];
  const s2 = buffer[tau + 1];
  const denom = s0 - 2 * s1 + s2;
  if (Math.abs(denom) < 1e-10) return tau;
  return tau + (s0 - s2) / (2 * denom);
}

/**
 * Parse a WAV file (ArrayBuffer) and return Float32Array of normalized samples + sample rate.
 * Supports PCM 16-bit and 32-bit float.
 */
export function parseWav(buffer: ArrayBuffer): { samples: Float32Array; sampleRate: number } | null {
  try {
    const view = new DataView(buffer);

    // RIFF header check
    if (view.getUint32(0, false) !== 0x52494646) return null; // 'RIFF'
    if (view.getUint32(8, false) !== 0x57415645) return null; // 'WAVE'

    let offset = 12;
    let sampleRate = 44100;
    let numChannels = 1;
    let bitsPerSample = 16;
    let audioFormat = 1; // PCM
    let dataOffset = -1;
    let dataSize = 0;

    while (offset < buffer.byteLength - 8) {
      const chunkId = view.getUint32(offset, false);
      const chunkSize = view.getUint32(offset + 4, true);

      if (chunkId === 0x666d7420) { // 'fmt '
        audioFormat = view.getUint16(offset + 8, true);
        numChannels = view.getUint16(offset + 10, true);
        sampleRate = view.getUint32(offset + 12, true);
        bitsPerSample = view.getUint16(offset + 22, true);
      } else if (chunkId === 0x64617461) { // 'data'
        dataOffset = offset + 8;
        dataSize = chunkSize;
        break;
      }

      offset += 8 + chunkSize;
      if (chunkSize % 2 !== 0) offset++; // word-align
    }

    if (dataOffset < 0 || dataSize <= 0) return null;

    const bytesPerSample = bitsPerSample / 8;
    const totalSamples = Math.floor(dataSize / (bytesPerSample * numChannels));
    const samples = new Float32Array(totalSamples);

    for (let i = 0; i < totalSamples; i++) {
      const byteOffset = dataOffset + i * bytesPerSample * numChannels;
      if (byteOffset + bytesPerSample > buffer.byteLength) break;

      let val: number;
      if (audioFormat === 3 && bitsPerSample === 32) {
        // IEEE float
        val = view.getFloat32(byteOffset, true);
      } else if (bitsPerSample === 16) {
        val = view.getInt16(byteOffset, true) / 32768;
      } else if (bitsPerSample === 8) {
        val = (view.getUint8(byteOffset) - 128) / 128;
      } else if (bitsPerSample === 32) {
        val = view.getInt32(byteOffset, true) / 2147483648;
      } else {
        val = 0;
      }
      samples[i] = val;
    }

    return { samples, sampleRate };
  } catch {
    return null;
  }
}
