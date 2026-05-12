import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';

export interface RecQuality {
  sampleRate: 22050 | 44100 | 48000;
  channels:   1 | 2;
  bitRate:    64000 | 128000 | 256000;
}

export const QUALITY_FILE = (FileSystem.documentDirectory ?? '') + 'rec_quality.json';

export const QUALITY_PRESETS: { label: string; sub: string; q: RecQuality }[] = [
  { label: 'Voice',   sub: '22 kHz · Mono · 64 kbps',    q: { sampleRate: 22050, channels: 1, bitRate: 64000  } },
  { label: 'Standard',sub: '44 kHz · Mono · 128 kbps',   q: { sampleRate: 44100, channels: 1, bitRate: 128000 } },
  { label: 'Hi-Fi',   sub: '44 kHz · Stereo · 256 kbps', q: { sampleRate: 44100, channels: 2, bitRate: 256000 } },
  { label: 'Studio',  sub: '48 kHz · Stereo · 256 kbps', q: { sampleRate: 48000, channels: 2, bitRate: 256000 } },
];

export const DEFAULT_QUALITY: RecQuality = QUALITY_PRESETS[1].q;

export function presetLabel(q: RecQuality): string {
  return QUALITY_PRESETS.find(
    p => p.q.sampleRate === q.sampleRate && p.q.channels === q.channels && p.q.bitRate === q.bitRate
  )?.label ?? 'Custom';
}

export async function loadQualitySettings(): Promise<RecQuality> {
  try {
    const info = await FileSystem.getInfoAsync(QUALITY_FILE);
    if (info.exists) return JSON.parse(await FileSystem.readAsStringAsync(QUALITY_FILE));
  } catch {}
  return DEFAULT_QUALITY;
}

export async function saveQualitySettings(q: RecQuality): Promise<void> {
  await FileSystem.writeAsStringAsync(QUALITY_FILE, JSON.stringify(q));
}

/** Build expo-av recording options from a quality preset */
export function buildRecordingOptions(q: RecQuality): Audio.RecordingOptions {
  const iosQ = q.bitRate >= 256000
    ? Audio.IOSAudioQuality.MAX
    : q.bitRate >= 128000
    ? Audio.IOSAudioQuality.HIGH
    : Audio.IOSAudioQuality.MEDIUM;

  return {
    android: {
      extension: '.m4a',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: q.sampleRate,
      numberOfChannels: q.channels,
      bitRate: q.bitRate,
    },
    ios: {
      extension: '.m4a',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: iosQ,
      sampleRate: q.sampleRate,
      numberOfChannels: q.channels,
      bitRate: q.bitRate,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {},
  };
}
