#!/usr/bin/env python3
"""
Run Demucs two-stem (vocals / no_vocals) separation.
Stdout: one JSON line { ok, stems?, error?, code? }
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def demucs_available() -> bool:
    try:
        import demucs  # noqa: F401
        return True
    except ImportError:
        return False


def find_stem_wavs(out_dir: Path, track_stem: str) -> dict[str, Path]:
    """Locate vocals.wav and no_vocals.wav under Demucs output tree."""
    found: dict[str, Path] = {}
    for pattern in (
        f"**/htdemucs/{track_stem}/vocals.wav",
        f"**/htdemucs/{track_stem}/no_vocals.wav",
        f"**/htdemucs_ft/{track_stem}/vocals.wav",
        f"**/htdemucs_ft/{track_stem}/no_vocals.wav",
    ):
        for p in out_dir.glob(pattern):
            key = p.stem
            if key in ("vocals", "no_vocals"):
                found[key] = p
    if not found:
        for name in ("vocals.wav", "no_vocals.wav"):
            for p in out_dir.rglob(name):
                key = p.stem
                if key not in found:
                    found[key] = p
    return found


def run_separation(input_path: Path, work_dir: Path, mode: str) -> dict:
    if not input_path.is_file():
        return {"ok": False, "code": "INPUT_MISSING", "error": f"Файл не найден: {input_path}"}

    if not demucs_available():
        return {
            "ok": False,
            "code": "DEMUCS_NOT_INSTALLED",
            "error": "Python-пакет demucs не установлен. См. tools/stem-separate/README.md",
        }

    out_root = work_dir / "demucs_out"
    out_root.mkdir(parents=True, exist_ok=True)
    track_stem = input_path.stem

    cmd = [
        sys.executable,
        "-m",
        "demucs",
        "--two-stems",
        "vocals",
        "-o",
        str(out_root),
        str(input_path),
    ]

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=int(__import__("os").environ.get("STEM_DEMUCS_TIMEOUT_SEC", "900")),
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "code": "TIMEOUT", "error": "Demucs превысил лимит времени"}
    except Exception as e:
        return {"ok": False, "code": "DEMUCS_FAILED", "error": str(e)}

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip() or f"exit {proc.returncode}"
        return {"ok": False, "code": "DEMUCS_FAILED", "error": err[:2000]}

    wavs = find_stem_wavs(out_root, track_stem)
    if not wavs:
        return {
            "ok": False,
            "code": "OUTPUT_MISSING",
            "error": "Demucs завершился, но vocals/no_vocals не найдены в выходной папке",
        }

    want = []
    if mode in ("vocals", "all"):
        want.append("vocals")
    if mode in ("minus", "all"):
        want.append("no_vocals")

    stems = []
    labels = {"vocals": "Вокал", "no_vocals": "Минус"}
    colors = {"vocals": "#ff9800", "no_vocals": "#ff5252"}
    ids = {"vocals": "vocals", "no_vocals": "minus"}

    for key in want:
        p = wavs.get(key)
        if not p or not p.is_file():
            return {"ok": False, "code": "OUTPUT_MISSING", "error": f"Нет дорожки: {key}"}
        stems.append(
            {
                "id": ids[key],
                "label": labels[key],
                "color": colors[key],
                "path": str(p.resolve()),
                "sizeKb": max(1, p.stat().st_size // 1024),
            }
        )

    return {"ok": True, "stems": stems}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="")
    parser.add_argument("--work-dir", default="")
    parser.add_argument("--mode", default="minus", choices=("vocals", "minus", "all"))
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()

    if args.check_only:
        print(
            json.dumps(
                {
                    "ok": True,
                    "demucs": demucs_available(),
                    "python": sys.executable,
                    "version": sys.version.split()[0],
                },
                ensure_ascii=False,
            )
        )
        return 0

    if not args.input or not args.work_dir:
        print(json.dumps({"ok": False, "error": "Нужны --input и --work-dir"}, ensure_ascii=False))
        return 1

    work_dir = Path(args.work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)
    result = run_separation(Path(args.input), work_dir, args.mode)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
