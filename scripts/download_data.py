"""Baixa os resultados do Brasileirao Serie A do football-data.co.uk.

Fonte: https://www.football-data.co.uk/brazil.php
O arquivo BRA.csv contem uma linha por partida, com placar e odds de varios
mercados (Bet365, Pinnacle, Betfair, media e maxima do mercado).

Uso:
    python scripts/download_data.py
"""

from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

URL = "https://www.football-data.co.uk/new/BRA.csv"
DEST = Path(__file__).resolve().parents[1] / "data" / "raw" / "brasileirao.csv"


def main() -> int:
    DEST.parent.mkdir(parents=True, exist_ok=True)
    print(f"Baixando {URL} ...")
    with urllib.request.urlopen(URL, timeout=60) as resp:
        payload = resp.read()

    if len(payload) < 100_000:
        print("ERRO: arquivo menor que o esperado, download provavelmente falhou.")
        return 1

    DEST.write_bytes(payload)
    digest = hashlib.sha256(payload).hexdigest()[:12]
    print(f"OK: {DEST} ({len(payload):,} bytes, sha256:{digest})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
