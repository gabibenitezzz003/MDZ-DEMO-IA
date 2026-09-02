#!/usr/bin/env python3
"""Generate an ODK Collect settings QR (zlib + Base64 JSON)."""

from __future__ import annotations

import base64
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "odk"

SETTINGS = {
    "general": {
        "server_url": "https://demo.getodk.org",
        "username": "",
        "password": "",
        "protocol": "odk_default",
    },
    "admin": {},
    "project": {
        "name": "Agricultura Mendoza",
        "icon": "A",
        "color": "#1d4ed8",
    },
}


def encode_payload(settings: dict) -> str:
    raw = json.dumps(settings, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.b64encode(gzip.compress(raw)).decode("ascii")


def main() -> None:
    import shutil
    import subprocess

    if not shutil.which("qrencode"):
        raise SystemExit("Falta qrencode (paquete qrencode).")

    OUT.mkdir(parents=True, exist_ok=True)
    payload = encode_payload(SETTINGS)
    meta = {
        **SETTINGS,
        "_meta": {
            "tipo": "ODK_Collect_settings_qr",
            "encoding": "gzip+base64",
            "uso": "ODK Collect (Android) → Agregar proyecto → Escanear código QR",
            "manual": {
                "url": SETTINGS["general"]["server_url"],
                "usuario": SETTINGS["general"]["username"] or "(vacío)",
                "contraseña": SETTINGS["general"]["password"] or "(vacío)",
            },
        },
    }
    (OUT / "odk-collect-payload.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "demo-odk-payload.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "odk-collect-payload.txt").write_text(payload + "\n", encoding="utf-8")

    for name in ("odk-collect", "demo-odk-collect"):
        subprocess.check_call(
            [
                "qrencode",
                "-o",
                str(OUT / f"{name}.png"),
                "-s",
                "10",
                "-m",
                "4",
                "-l",
                "H",
                payload,
            ]
        )
        subprocess.check_call(
            [
                "qrencode",
                "-t",
                "SVG",
                "-o",
                str(OUT / f"{name}.svg"),
                "-s",
                "10",
                "-m",
                "4",
                "-l",
                "H",
                payload,
            ]
        )
    print(f"Wrote ODK Collect QR ({len(payload)} chars, gzip+base64) to {OUT}")


if __name__ == "__main__":
    main()
