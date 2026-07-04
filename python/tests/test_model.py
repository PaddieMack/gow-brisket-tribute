"""Regression tests for brisket_model.

Both worked examples here are pinned to real numbers published by Steve
Gow -- one from the spreadsheet's own example (D29/B31/B33), and one from
his exact zone-by-zone breakdown in a comment reply to a reader named Jack
(May 21, 2026). If these ever fail, the port has drifted from the source.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from brisket_model import (
    hours_needed_at_temp,
    rate_at_temp,
    texture_for_percent,
    total_percent_done,
    worked_example,
)
from brisket_model.calculator import documented_case_studies, evaluate


def test_rate_at_temp_zone_matches_table():
    assert rate_at_temp(135, mode="zone") == 0
    assert rate_at_temp(140, mode="zone") == 1
    assert rate_at_temp(190, mode="zone") == 18
    assert rate_at_temp(210, mode="zone") == 75


def test_rate_at_temp_zone_floors_like_steve_described():
    # "150 zone means between 150 and 160 for the sake of simplicity"
    assert rate_at_temp(158, mode="zone") == 2
    assert rate_at_temp(150, mode="zone") == 2
    assert rate_at_temp(159.9, mode="zone") == 2
    # 189 is still "180" per Steve's comment.
    assert rate_at_temp(189, mode="zone") == 9


def test_rate_at_temp_clamps_outside_table():
    assert rate_at_temp(50, mode="zone") == 0
    assert rate_at_temp(300, mode="zone") == 75


def test_rate_at_temp_interpolated_is_between_neighbors():
    r150 = rate_at_temp(150, mode="interpolated")
    r160 = rate_at_temp(160, mode="interpolated")
    r155 = rate_at_temp(155, mode="interpolated")
    assert r150 < r155 < r160
    # Steve's own ballpark for the midpoint: "~2.6%"
    assert math.isclose(r155, 2.6, abs_tol=0.2)


def test_texture_for_percent_matches_spreadsheet_formula():
    assert texture_for_percent(79.9) == "Underdone"
    assert texture_for_percent(80) == "Slightly Underdone"
    assert texture_for_percent(94.9) == "Slightly Underdone"
    assert texture_for_percent(95) == "PERFECTLY TENDER"
    assert texture_for_percent(110) == "PERFECTLY TENDER"
    assert texture_for_percent(110.1) == "Slightly Over"
    assert texture_for_percent(120) == "Slightly Over"
    assert texture_for_percent(120.1) == "Overdone"


def test_spreadsheet_worked_example_195_pull_150_hold():
    example = worked_example()
    entries = example["cook_zone_hours"] + example["hold_zone_hours"]
    result = evaluate(entries, mode="zone")
    assert math.isclose(result.total_percent, example["expected_total_percent"])
    assert result.texture == example["expected_texture"]


def test_jacks_documented_case_study_190_pull_160_hold():
    case = documented_case_studies()[0]
    entries = case["cook_zone_hours"] + case["hold_zone_hours"]
    total = total_percent_done(entries, mode="zone")
    assert math.isclose(total, case["expected_total_percent"])
    assert texture_for_percent(total) == case["expected_texture"]


def test_hours_needed_at_temp_basic():
    # At 150F (2%/hr), going from 90% to 100% needs 5 more hours.
    assert math.isclose(hours_needed_at_temp(90, 150, target_percent=100), 5.0)


def test_hours_needed_at_temp_below_render_floor_is_infinite():
    assert hours_needed_at_temp(50, 100) == math.inf


def test_hours_needed_at_temp_already_done_is_zero():
    assert hours_needed_at_temp(105, 150, target_percent=100) == 0.0
