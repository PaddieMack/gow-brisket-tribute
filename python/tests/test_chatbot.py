"""Regression tests for the rule-based chatbot (brisket_model.chatbot).

These pin down two real bugs found during manual smoke-testing:
1. Greedy '.{0,N}' filler before a \\d+ capture group would eat leading
   digits, e.g. "rate at 190" wrongly captured "0" instead of "190".
2. "held" (past tense) wasn't recognized as a hold-verb, only "hold".
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from brisket_model.chatbot import answer


def test_rate_lookup_captures_full_number_not_last_digit():
    reply = answer("what's the rendering rate at 190?")
    assert "190" in reply
    assert "at 0F" not in reply


def test_rate_lookup_handles_how_fast_phrasing():
    reply = answer("how fast does it render at 205")
    assert "205" in reply


def test_pulled_and_held_past_tense_is_recognized():
    reply = answer("I pulled at 195 and held at 150 for 14 hours, is it done?")
    assert "don't have a documented cooldown" not in reply
    assert "%" in reply


def test_pulled_and_holding_present_participle_is_recognized():
    reply = answer("pulled at 195, holding at 150 for 18 hours")
    assert "%" in reply


def test_unknown_pull_temp_gives_honest_fallback_not_crash():
    reply = answer("I pulled at 170 and held at 170 for 18 hours")
    assert "don't have a documented cooldown" in reply


def test_hours_needed_phrasing():
    reply = answer("how many hours from 90% to 100% at 150?")
    assert "150" in reply and "%" in reply


def test_greeting_and_about_and_safety_smoke():
    assert "confirmed" in answer("confirmed method").lower() or "smoker" in answer("confirmed method").lower()
    assert "135" in answer("is this safe?")
    assert "steve gow" in answer("who is steve gow").lower()


def test_fallback_does_not_crash_on_gibberish():
    reply = answer("asdkjfh qwoeiruqwoiuer")
    assert isinstance(reply, str) and len(reply) > 0
