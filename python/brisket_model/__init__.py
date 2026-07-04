"""brisket_model: a faithful Python port of Steve Gow's Brisket "Cook & Hold"
Tenderness Model (Smoke Trails BBQ).

Unofficial fan tribute. Original article:
https://smoketrailsbbq.com/brisket-holding-masterclass-and-tenderness-model/
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
from .chatbot import answer as chatbot_answer
from .model import food_safety_note, rate_at_temp, texture_for_percent

__all__ = [
    "CalculatorResult",
    "ZoneEntry",
    "chatbot_answer",
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

__version__ = "0.1.0"
