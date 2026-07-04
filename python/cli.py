#!/usr/bin/env python3
"""Tribute terminal app for Steve Gow's Brisket "Cook & Hold" Tenderness
Model. Unofficial fan project -- full credit & original article:
https://smoketrailsbbq.com/brisket-holding-masterclass-and-tenderness-model/

Run:
    python3 python/cli.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from brisket_model import (
    chatbot_answer,
    confirmed_methods,
    documented_case_studies,
    evaluate,
    food_safety_note,
    rate_at_temp,
)

RESET = "\033[0m"
BOLD = "\033[1m"
ORANGE = "\033[38;5;208m"
RED = "\033[38;5;124m"
GREY = "\033[38;5;245m"
GREEN = "\033[38;5;70m"

SMOKER_ART = rf"""{ORANGE}
        )  (
       (   ) )
        ) ( (        {GREY}~ smoke trails ~{ORANGE}
      _______)_
   .-'---------|
  ( C|/\/\/\/\/|
   '-./\/\/\/\/|
     '_________'
      '-------'{RESET}
"""

BANNER = f"""{BOLD}{RED}
  The Gow Method -- Brisket Cook & Hold Tribute
{RESET}{GREY}  Unofficial fan tribute to Steve Gow (Smoke Trails BBQ)
  https://smoketrailsbbq.com/brisket-holding-masterclass-and-tenderness-model/
{RESET}"""

MENU = f"""
{BOLD}What do you want to do?{RESET}
  {ORANGE}1{RESET}) Run the Cook & Hold calculator
  {ORANGE}2{RESET}) Show Steve's confirmed methods
  {ORANGE}3{RESET}) Show a documented case study (worked example)
  {ORANGE}4{RESET}) Look up a rendering rate at a temperature
  {ORANGE}5{RESET}) Ask Steve (rule-based chat)
  {ORANGE}q{RESET}) Quit
"""


def prompt_float(label: str, default: float | None = None) -> float:
    suffix = f" [{default:g}]" if default is not None else ""
    while True:
        raw = input(f"{label}{suffix}: ").strip()
        if not raw and default is not None:
            return default
        try:
            return float(raw)
        except ValueError:
            print("  please enter a number")


def run_calculator() -> None:
    print(f"\n{BOLD}Cook & Hold Calculator{RESET}")
    print("Enter temp/hours pairs for every zone your brisket spent time in")
    print("(cook AND hold combined). Leave temp blank when done.\n")
    entries = []
    while True:
        raw_temp = input("  Internal temp (F), blank to finish: ").strip()
        if not raw_temp:
            break
        try:
            temp = float(raw_temp)
        except ValueError:
            print("  please enter a number")
            continue
        hours = prompt_float("  Hours at this temp", default=1.0)
        entries.append({"temp_f": temp, "hours": hours})

    if not entries:
        print("No zones entered, nothing to calculate.")
        return

    result = evaluate(entries, mode="zone")
    color = GREEN if result.in_target_range else ORANGE
    print(f"\n{BOLD}Total Percent Done:{RESET} {color}{result.total_percent:.1f}%{RESET}")
    print(f"{BOLD}Texture:{RESET} {color}{result.texture}{RESET}")
    if result.remaining_to_100 > 0:
        print(f"Remaining to 100%: {result.remaining_to_100:.1f}%")
    print(f"\n{GREY}{food_safety_note()}{RESET}")


def show_confirmed_methods() -> None:
    print(f"\n{BOLD}Steve's Confirmed Methods{RESET}")
    for m in confirmed_methods():
        print(
            f"  - ~{m['hours_on_smoker_plus_minus_2']} hr smoker -> "
            f"{m['pull_temp_f']}F ({m['pull_texture']}), "
            f"rest before hold: {m['rest_before_hold']}, "
            f"hold {m['hold_temp_f']}F x {m['hold_time_hours']} hr"
        )


def show_case_study() -> None:
    case = documented_case_studies()[0]
    print(f"\n{BOLD}Documented Case Study{RESET}")
    print(case["description"])
    print(f"Expected: {case['expected_total_percent']}% -> {case['expected_texture']}")


def lookup_rate() -> None:
    temp = prompt_float("Temperature (F)", default=190.0)
    zone = rate_at_temp(temp, mode="zone")
    interp = rate_at_temp(temp, mode="interpolated")
    print(f"  Zone model: {zone:g}%/hr   Interpolated: {interp:.1f}%/hr")


def ask_steve() -> None:
    print(f"\n{BOLD}Ask Steve{RESET} (rule-based, offline -- type 'back' to return)\n")
    while True:
        try:
            msg = input("you> ").strip()
        except EOFError:
            return
        if msg.lower() in {"back", "exit", "quit"}:
            return
        print(f"steve> {chatbot_answer(msg)}\n")


def main() -> None:
    print(SMOKER_ART)
    print(BANNER)
    actions = {
        "1": run_calculator,
        "2": show_confirmed_methods,
        "3": show_case_study,
        "4": lookup_rate,
        "5": ask_steve,
    }
    while True:
        print(MENU)
        try:
            choice = input("> ").strip().lower()
        except EOFError:
            break
        if choice == "q":
            break
        action = actions.get(choice)
        if action:
            action()
        else:
            print("Not a valid option.")
    print(f"\n{GREY}Thanks for stopping by. Go smoke a brisket.{RESET}")


if __name__ == "__main__":
    main()
