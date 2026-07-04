"""brisket_model: a faithful Python port of Steve Gow's Brisket "Cook & Hold"
Tenderness Model (Smoke Trails BBQ).

Unofficial fan tribute. Original article:
https://smoketrailsbbq.com/brisket-holding-masterclass-and-tenderness-model/

This package is the deterministic math engine (rendering rates, Percent
Done calculator, texture prediction). It has no chatbot/CLI of its own --
the web app's "Ask Steve" chat uses the equivalent JS port
(assets/js/model.js) to ground its LLM answers with real computed numbers
instead of letting the model guess at arithmetic. See assets/js/grounding.js.
"""
from .calculator import (
    CalculatorResult,
    ZoneEntry,
    confirmed_methods,
    documented_case_studies,
    evaluate,
    hours_needed_at_temp,
    project_timeline,
    standard_cooldown_patterns,
    total_percent_done,
    worked_example,
)
from .model import food_safety_note, rate_at_temp, texture_for_percent

__all__ = [
    "CalculatorResult",
    "ZoneEntry",
    "confirmed_methods",
    "documented_case_studies",
    "evaluate",
    "food_safety_note",
    "hours_needed_at_temp",
    "project_timeline",
    "rate_at_temp",
    "standard_cooldown_patterns",
    "texture_for_percent",
    "total_percent_done",
    "worked_example",
]

__version__ = "0.2.0"
