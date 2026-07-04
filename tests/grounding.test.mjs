// Node tests for assets/js/grounding.js -- the deterministic fact-extraction
// layer that grounds the LLM chat's numeric answers. Carries forward the
// same regression cases that caught real bugs in the original rule-based
// responder (greedy-digit-eating filler, "held" not recognized as a
// hold-verb), since this reuses the same regex approach.
import { test } from "node:test";
import assert from "node:assert/strict";

import { extractGroundedFact } from "../docs/assets/js/grounding.js";

test("rate lookup captures full number, not last digit", () => {
  const fact = extractGroundedFact("what's the rendering rate at 190?");
  assert.ok(fact.includes("190"));
  assert.ok(!fact.includes("at 0F"));
});

test("rate lookup handles 'how fast' phrasing", () => {
  const fact = extractGroundedFact("how fast does it render at 205");
  assert.ok(fact.includes("205"));
});

test("pulled + held (past tense) is recognized", () => {
  const fact = extractGroundedFact("I pulled at 195 and held at 150 for 14 hours, is it done?");
  assert.ok(fact.startsWith("COMPUTED FACT:"));
  assert.ok(fact.includes("%"));
});

test("pulled + holding (present participle) is recognized", () => {
  const fact = extractGroundedFact("pulled at 195, holding at 150 for 18 hours");
  assert.ok(fact.includes("%"));
});

test("unknown pull temp gives an honest 'no data' fact, not invented numbers", () => {
  const fact = extractGroundedFact("I pulled at 170 and held at 170 for 18 hours");
  assert.ok(fact.includes("No documented cooldown curve"));
});

test("hours-needed phrasing", () => {
  const fact = extractGroundedFact("how many hours from 90% to 100% at 150?");
  assert.ok(fact.includes("150") && fact.includes("%"));
});

test("confirmed methods keyword returns real method data", () => {
  const fact = extractGroundedFact("give me a confirmed method");
  assert.ok(fact.includes("195F") || fact.includes("190F"));
});

test("safety keyword returns the real food safety note", () => {
  const fact = extractGroundedFact("is this safe?");
  assert.ok(fact.includes("135"));
});

test("unrecognized free-form question returns null (LLM handles it unaided)", () => {
  const fact = extractGroundedFact("why does brisket have so much connective tissue anyway?");
  assert.equal(fact, null);
});

test("empty message returns null", () => {
  assert.equal(extractGroundedFact(""), null);
  assert.equal(extractGroundedFact("   "), null);
});
