"""Calculator built on top of the rendering-rate model: turns a list of
(temperature, hours) entries into a Percent Done total, a texture verdict,
and answers "how many more hours do I need" style questions.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

from .data import load_model
from .model import rate_at_temp, texture_for_percent


@dataclass(frozen=True)
class ZoneEntry:
    temp_f: float
    hours: float


ZoneInput = Sequence[ZoneEntry] | Sequence[tuple[float, float]] | Sequence[dict]


def _normalize(entries: ZoneInput) -> list[ZoneEntry]:
    normalized = []
    for e in entries:
        if isinstance(e, ZoneEntry):
            normalized.append(e)
        elif isinstance(e, dict):
            normalized.append(ZoneEntry(e["temp_f"], e["hours"]))
        else:
            temp_f, hours = e
            normalized.append(ZoneEntry(temp_f, hours))
    return normalized


def total_percent_done(entries: ZoneInput, mode: str = "zone") -> float:
    """Sum rate_at_temp(temp) * hours across every zone entry (cook + hold
    combined), exactly like SUM(D6:D27) in the spreadsheet.
    """
    total = 0.0
    for entry in _normalize(entries):
        total += rate_at_temp(entry.temp_f, mode=mode) * entry.hours
    return total


@dataclass(frozen=True)
class CalculatorResult:
    total_percent: float
    remaining_to_100: float
    texture: str
    in_target_range: bool


def evaluate(entries: ZoneInput, mode: str = "zone") -> CalculatorResult:
    model = load_model()
    total = total_percent_done(entries, mode=mode)
    target = model["target_range"]
    return CalculatorResult(
        total_percent=total,
        remaining_to_100=max(0.0, 100.0 - total),
        texture=texture_for_percent(total),
        in_target_range=target["min_percent"] <= total <= target["max_percent"],
    )


def hours_needed_at_temp(
    current_percent: float,
    hold_temp_f: float,
    target_percent: float = 100.0,
    mode: str = "zone",
) -> float:
    """How many more hours at `hold_temp_f` to go from current_percent to
    target_percent? Returns math.inf if the rate at that temp is 0 (e.g.
    holding below the point where collagen renders at all).
    """
    rate = rate_at_temp(hold_temp_f, mode=mode)
    remaining = target_percent - current_percent
    if remaining <= 0:
        return 0.0
    if rate <= 0:
        return float("inf")
    return remaining / rate


def confirmed_methods() -> list[dict]:
    return load_model()["confirmed_methods"]


def standard_cooldown_patterns() -> list[dict]:
    return load_model()["standard_cooldown_patterns"]


def documented_case_studies() -> list[dict]:
    return load_model()["documented_case_studies"]


def worked_example() -> dict:
    return load_model()["worked_example"]


def project_timeline(entries: ZoneInput, mode: str = "zone") -> list[dict]:
    """Return a running cumulative-percent timeline, one point per zone
    entry in order -- handy for charting "percent done over time".
    """
    timeline = []
    running_hours = 0.0
    running_percent = 0.0
    for entry in _normalize(entries):
        rate = rate_at_temp(entry.temp_f, mode=mode)
        running_hours += entry.hours
        running_percent += rate * entry.hours
        timeline.append(
            {
                "temp_f": entry.temp_f,
                "hours": entry.hours,
                "cumulative_hours": running_hours,
                "rate_percent_per_hour": rate,
                "cumulative_percent": running_percent,
                "texture": texture_for_percent(running_percent),
            }
        )
    return timeline
