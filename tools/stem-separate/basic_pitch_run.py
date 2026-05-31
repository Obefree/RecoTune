#!/usr/bin/env python3
"""
Run Spotify basic-pitch on an audio file.
Stdout: one JSON line { ok, notes?, error?, code? }
notes[]: { startMs, endMs, midi, amplitude }
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

NOTE_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")


def basic_pitch_available() -> bool:
    try:
        import basic_pitch  # noqa: F401
        return True
    except ImportError:
        return False


def midi_to_note_name(midi: int) -> tuple[str, int]:
    midi = int(round(midi))
    note_idx = midi % 12
    octave = midi // 12 - 1
    return NOTE_NAMES[note_idx], octave


def run_transcription(input_path: Path) -> dict:
    if not input_path.is_file():
        return {"ok": False, "code": "INPUT_MISSING", "error": f"Файл не найден: {input_path}"}

    if not basic_pitch_available():
        return {
            "ok": False,
            "code": "BASIC_PITCH_NOT_INSTALLED",
            "error": "Python-пакет basic-pitch не установлен. См. tools/stem-separate/README.md",
        }

    try:
        from basic_pitch.inference import predict
    except Exception as e:
        return {
            "ok": False,
            "code": "BASIC_PITCH_NOT_INSTALLED",
            "error": f"Не удалось импортировать basic_pitch: {e}",
        }

    try:
        _model_output, _midi_data, note_events = predict(str(input_path))
    except Exception as e:
        return {"ok": False, "code": "BASIC_PITCH_FAILED", "error": str(e)[:2000]}

    notes = []
    for ev in note_events or []:
        if not ev or len(ev) < 3:
            continue
        start_s = float(ev[0])
        end_s = float(ev[1])
        pitch = float(ev[2])
        amplitude = float(ev[3]) if len(ev) > 3 and ev[3] is not None else 0.7
        start_ms = max(0, round(start_s * 1000))
        end_ms = max(start_ms + 1, round(end_s * 1000))
        midi = int(round(pitch))
        notes.append(
            {
                "startMs": start_ms,
                "endMs": end_ms,
                "midi": midi,
                "amplitude": round(amplitude, 4),
            }
        )

    notes.sort(key=lambda n: (n["startMs"], n["midi"]))

    if not notes:
        return {
            "ok": False,
            "code": "NO_NOTES",
            "error": "basic-pitch не нашёл нот в этом файле",
        }

    return {"ok": True, "notes": notes, "engine": "basic-pitch", "noteCount": len(notes)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="")
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()

    if args.check_only:
        print(
            json.dumps(
                {
                    "ok": True,
                    "basic_pitch": basic_pitch_available(),
                    "python": sys.executable,
                    "version": sys.version.split()[0],
                },
                ensure_ascii=False,
            )
        )
        return 0

    if not args.input:
        print(json.dumps({"ok": False, "error": "Нужен --input"}, ensure_ascii=False))
        return 1

    result = run_transcription(Path(args.input))
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
