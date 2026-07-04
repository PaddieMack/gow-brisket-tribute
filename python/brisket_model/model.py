"""Core math for Steve Gow's Brisket "Cook & Hold" Tenderness Model.

Everything here is a faithful port of the "Brisket Calculator" / "Tenderness
Model" sheets in Steve Gow's published spreadsheet. See:
https://smoketrailsbbq.com/brisket-holding-masterclass-and-tenderness-model/

Two lookup modes are offered for `rate_at_temp`:

- "zone" (default): reproduces the spreadsheet exactly. Steve Gow clarified
  in the article comments that a temperature like 158F belongs to the "150"
  zone (i.e. it floors down to the nearest defined table point):
      "150 zone means between 150 and 160 for the sake of simplicity"
  Below the lowest defined point (135F) the rate is 0. Above the highest
  (210F) the rate is clamped at the 210F rate.

- "interpolated": a smoother log-linear (Arrhenius-style) interpolation
  between the two bracketing table points, per Steve Gow's own suggestion
  for extra precision:
      "it's exponential so it's not just a straight 0.1% increase per
       degree... 155 = ~2.6%"
  This is our own simple interpolation inspired by that comment thread
  (including reader discussion of the Arrhenius equation) -- it is not a
  reproduction of any third party's independently-fit model.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from .data import load_model

MIN_SAFE_HOLD_TEMP_F = 135.0


@dataclass(frozen=True)
class RatePoint:
    temp_f: float
    percent_per_hour: float


def _rate_points() -> list[RatePoint]:
    model = load_model()
    points = [
        RatePoint(p["temp_f"], p["percent_per_hour"])
        for p in model["rendering_rates"]
    ]
    return sorted(points, key=lambda p: p.temp_f)


def rate_at_temp(temp_f: float, mode: str = "zone") -> float:
    """Return the % rendered per hour at a given internal temperature.

    mode="zone" replicates the spreadsheet's discrete lookup (floors to the
    nearest defined table point, per Steve Gow's own rule).
    mode="interpolated" smooths between table points on a log scale.
    """
    points = _rate_points()

    if temp_f <= points[0].temp_f:
        return points[0].percent_per_hour
    if temp_f >= points[-1].temp_f:
        return points[-1].percent_per_hour

    if mode == "zone":
        floor_point = points[0]
        for p in points:
            if p.temp_f <= temp_f:
                floor_point = p
            else:
                break
        return floor_point.percent_per_hour

    if mode == "interpolated":
        for lo, hi in zip(points, points[1:]):
            if lo.temp_f <= temp_f <= hi.temp_f:
                return _log_linear_interp(temp_f, lo, hi)
        return points[-1].percent_per_hour  # pragma: no cover - unreachable

    raise ValueError(f"Unknown mode: {mode!r} (expected 'zone' or 'interpolated')")


def _log_linear_interp(temp_f: float, lo: RatePoint, hi: RatePoint) -> float:
    if lo.percent_per_hour <= 0:
        # Can't take log(0); treat the low end as a hard floor instead of
        # trying to interpolate from zero (matches the "negligible below
        # 140F" framing in the article).
        if temp_f <= lo.temp_f:
            return lo.percent_per_hour
        lo_rate = 1e-6
    else:
        lo_rate = lo.percent_per_hour

    span = hi.temp_f - lo.temp_f
    if span == 0:
        return hi.percent_per_hour

    fraction = (temp_f - lo.temp_f) / span
    log_lo = math.log(lo_rate)
    log_hi = math.log(hi.percent_per_hour)
    return math.exp(log_lo + (log_hi - log_lo) * fraction)


def texture_for_percent(percent: float) -> str:
    """Replicates the spreadsheet's B33 nested-IF formula exactly:

    =IF(B31<80,"Underdone",
      IF(B31<95,"Slightly Underdone",
        IF(B31<=110,"PERFECTLY TENDER",
          IF(B31<=120,"Slightly Over","Overdone"))))
    """
    if percent < 80:
        return "Underdone"
    if percent < 95:
        return "Slightly Underdone"
    if percent <= 110:
        return "PERFECTLY TENDER"
    if percent <= 120:
        return "Slightly Over"
    return "Overdone"


def food_safety_note() -> str:
    return load_model()["food_safety_note"]
