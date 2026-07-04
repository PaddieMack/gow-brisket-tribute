"""A small deterministic, offline "Ask Steve" responder.

This is NOT a language model -- it's a regex/keyword rule-based Q&A layer
over the real calculator math. It exists so the tribute chatbot can answer
common brisket-doneness questions instantly, with zero downloads and zero
chance of hallucinating a number. The web app's JS chatbot (assets/js/
chatbot-rules.js) mirrors this same behaviour.

An optional real open-source LLM ("AI Mode") layers on top of this in the
web app for free-form conversation; see assets/js/chatbot-llm.js.
"""
from __future__ import annotations

import re

from .calculator import (
    confirmed_methods,
    documented_case_studies,
    hours_needed_at_temp,
    standard_cooldown_patterns,
)
from .data import load_model
from .model import food_safety_note, rate_at_temp, texture_for_percent

_NUMBER = r"(\d+(?:\.\d+)?)"

FALLBACK_TEXT = (
    "I'm a rule-based tribute bot for Steve Gow's brisket model -- try asking "
    "things like: 'what's the rendering rate at 190?', 'I pulled at 195 and "
    "held at 150 for 14 hours, is it done?', 'give me a confirmed method', "
    "or 'what's the tenderness guide?'"
)


def _fmt_pct(x: float) -> str:
    return f"{x:.1f}".rstrip("0").rstrip(".") + "%"


def _about() -> str:
    credit = load_model()["_credit"]
    return (
        f'This is a fan tribute to "{credit["method_name"]}" by '
        f'{credit["author"]} of {credit["source"]}. All the math here is '
        f'ported straight from his published spreadsheet. Full write-up: '
        f'{credit["article_url"]}\n\n{credit["note"]}'
    )


def _texture_guide() -> str:
    return (
        "Tenderness guide (Percent Done -> Texture):\n"
        "  80-90%   Slightly tight but sliceable\n"
        "  95-105%  Ideal tenderness\n"
        "  110-120% Very soft, possibly slightly over\n"
        "  120%+    Risk of mushy or over-rendered\n"
        "Target range: 95-110% is the sweet spot."
    )


def _confirmed_methods_text() -> str:
    lines = ["Steve's confirmed cook + hold methods:"]
    for m in confirmed_methods():
        lines.append(
            f"  - ~{m['hours_on_smoker_plus_minus_2']} hr smoker to "
            f"{m['pull_temp_f']}F ({m['pull_texture']}), "
            f"rest before hold: {m['rest_before_hold']}, "
            f"then hold at {m['hold_temp_f']}F for {m['hold_time_hours']} hr"
        )
    return "\n".join(lines)


def _rate_lookup_response(temp: float) -> str:
    zone_rate = rate_at_temp(temp, mode="zone")
    interp_rate = rate_at_temp(temp, mode="interpolated")
    return (
        f"At {temp:g}F, collagen renders at about {zone_rate:g}%/hr "
        f"(zone model), or ~{interp_rate:.1f}%/hr with smooth interpolation."
    )


def _pulled_and_hold_response(pull_temp: float, hold_temp: float, hold_hours: float | None) -> str:
    patterns = standard_cooldown_patterns()
    match = None
    if abs(pull_temp - 195) < 2.5:
        match = patterns[0]
    if match is None:
        return (
            f"I don't have a documented cooldown curve for pulling at "
            f"{pull_temp:g}F specifically -- Steve only published the exact "
            f"decline for a 195F pull into a holding oven. Try the web "
            f"calculator's Advanced mode and enter your own smoker log hours "
            f"per zone for the most accurate answer."
        )
    zone_hours = list(match["zone_hours"])
    declined_hours = sum(z["hours"] for z in zone_hours)
    remaining_hold_hours = max(0.0, (hold_hours or 0) - declined_hours)
    entries = zone_hours + [{"temp_f": hold_temp, "hours": remaining_hold_hours}]
    from .calculator import total_percent_done  # local import to avoid cycle at module load

    total = total_percent_done(entries, mode="zone")
    texture = texture_for_percent(total)
    return (
        f"Using Steve's documented decline pattern (1hr@190, 1hr@180, "
        f"1hr@170, 1hr@160, then stabilizing at {hold_temp:g}F) for "
        f"{hold_hours or 0:g} total hold hours: roughly {_fmt_pct(total)} "
        f"done -> {texture}. (This ignores whatever % you'd already built "
        f"up during the cook itself before the pull.)"
    )


def answer(message: str) -> str:
    text = message.strip().lower()

    if not text:
        return "Ask me something about brisket tenderness, rendering rates, or hold times!"

    if re.search(r"\b(hi|hello|hey|howdy)\b", text):
        return "Howdy! Ask me about rendering rates, hold times, or say 'confirmed method' for a tried-and-true cook plan."

    if any(k in text for k in ("who is steve", "who's steve", "about", "credit", "what is this")):
        return _about()

    if "safe" in text:
        return food_safety_note()

    if "confirmed" in text or "preset" in text or "just tell me what to do" in text:
        return _confirmed_methods_text()

    if ("tender" in text and ("scale" in text or "guide" in text or "mean" in text)) or "texture" in text:
        return _texture_guide()

    # NOTE: filler between a keyword and the number it modifies uses \D
    # (non-digit), not '.' -- a greedy '.{0,N}' right before \d+ will happily
    # eat leading digits too, backtracking only enough to leave a single
    # trailing digit for the capture group (e.g. "at 190" wrongly captures
    # just "0"). \D can't match digits, so it can't make that mistake.
    pulled_match = re.search(
        rf"pull(?:ed)?\D{{0,10}}{_NUMBER}.*?(?:hold(?:ing)?|held)\D{{0,10}}{_NUMBER}",
        text,
    )
    if pulled_match:
        pull_temp = float(pulled_match.group(1))
        hold_temp = float(pulled_match.group(2))
        hours_match = re.search(rf"{_NUMBER}\s*(?:hr|hour)", text)
        hold_hours = float(hours_match.group(1)) if hours_match else None
        return _pulled_and_hold_response(pull_temp, hold_temp, hold_hours)

    hours_needed_match = re.search(
        rf"from\D{{0,5}}{_NUMBER}%?.*?(?:to|at)\D{{0,5}}{_NUMBER}%?.*?"
        rf"(?:at|hold(?:ing)?|held)\D{{0,10}}{_NUMBER}",
        text,
    )
    if hours_needed_match:
        current = float(hours_needed_match.group(1))
        target = float(hours_needed_match.group(2))
        hold_temp = float(hours_needed_match.group(3))
        hrs = hours_needed_at_temp(current, hold_temp, target_percent=target)
        if hrs == float("inf"):
            return f"At {hold_temp:g}F collagen won't meaningfully render -- pick a higher hold temp."
        return f"About {hrs:.1f} more hours at {hold_temp:g}F to go from {current:g}% to {target:g}%."

    rate_match = re.search(rf"(?:rate|how fast)\D{{0,30}}{_NUMBER}", text)
    if rate_match:
        return _rate_lookup_response(float(rate_match.group(1)))

    if "jack" in text or "case study" in text:
        case = documented_case_studies()[0]
        return (
            f"{case['description']} Total: {case['expected_total_percent']}% "
            f"-> {case['expected_texture']}."
        )

    return FALLBACK_TEXT
