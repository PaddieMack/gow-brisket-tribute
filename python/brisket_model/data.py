"""Loads the canonical rendering-model data (data/rendering_model.json).

Keeping the data in one JSON file -- generated straight from Steve Gow's
spreadsheet by tools/extract_model.py -- means the Python package and the
JavaScript web app can never drift apart.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

# .../gow-brisket-tribute/data/rendering_model.json
DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "rendering_model.json"


@lru_cache(maxsize=1)
def load_model() -> dict:
    with DATA_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)
