// Node sanity tests for assets/js/model.js -- mirrors python/tests/test_model.py
// Run: node --test tests/model.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  rateAtTemp,
  textureForPercent,
  totalPercentDone,
  hoursNeededAtTemp,
  workedExample,
  documentedCaseStudies,
  evaluate,
} from "../assets/js/model.js";

test("rateAtTemp zone matches table", () => {
  assert.equal(rateAtTemp(135, "zone"), 0);
  assert.equal(rateAtTemp(140, "zone"), 1);
  assert.equal(rateAtTemp(190, "zone"), 18);
  assert.equal(rateAtTemp(210, "zone"), 75);
});

test("rateAtTemp zone floors like Steve described", () => {
  assert.equal(rateAtTemp(158, "zone"), 2);
  assert.equal(rateAtTemp(150, "zone"), 2);
  assert.equal(rateAtTemp(159.9, "zone"), 2);
  assert.equal(rateAtTemp(189, "zone"), 9);
});

test("rateAtTemp clamps outside table", () => {
  assert.equal(rateAtTemp(50, "zone"), 0);
  assert.equal(rateAtTemp(300, "zone"), 75);
});

test("rateAtTemp interpolated is between neighbors and near Steve's ballpark", () => {
  const r150 = rateAtTemp(150, "interpolated");
  const r160 = rateAtTemp(160, "interpolated");
  const r155 = rateAtTemp(155, "interpolated");
  assert.ok(r150 < r155 && r155 < r160);
  assert.ok(Math.abs(r155 - 2.6) < 0.2);
});

test("textureForPercent matches spreadsheet formula", () => {
  assert.equal(textureForPercent(79.9), "Underdone");
  assert.equal(textureForPercent(80), "Slightly Underdone");
  assert.equal(textureForPercent(94.9), "Slightly Underdone");
  assert.equal(textureForPercent(95), "PERFECTLY TENDER");
  assert.equal(textureForPercent(110), "PERFECTLY TENDER");
  assert.equal(textureForPercent(110.1), "Slightly Over");
  assert.equal(textureForPercent(120), "Slightly Over");
  assert.equal(textureForPercent(120.1), "Overdone");
});

test("spreadsheet worked example: 195F pull + 150F hold", () => {
  const example = workedExample();
  const entries = [...example.cook_zone_hours, ...example.hold_zone_hours];
  const result = evaluate(entries, "zone");
  assert.ok(Math.abs(result.totalPercent - example.expected_total_percent) < 1e-9);
  assert.equal(result.texture, example.expected_texture);
});

test("Jack's documented case study: 190F pull + 160F hold", () => {
  const [caseStudy] = documentedCaseStudies();
  const entries = [...caseStudy.cook_zone_hours, ...caseStudy.hold_zone_hours];
  const total = totalPercentDone(entries, "zone");
  assert.ok(Math.abs(total - caseStudy.expected_total_percent) < 1e-9);
  assert.equal(textureForPercent(total), caseStudy.expected_texture);
});

test("hoursNeededAtTemp basic", () => {
  assert.ok(Math.abs(hoursNeededAtTemp(90, 150, 100) - 5.0) < 1e-9);
});

test("hoursNeededAtTemp below render floor is Infinity", () => {
  assert.equal(hoursNeededAtTemp(50, 100), Infinity);
});

test("hoursNeededAtTemp already done is zero", () => {
  assert.equal(hoursNeededAtTemp(105, 150, 100), 0);
});
