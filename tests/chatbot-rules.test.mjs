// Node sanity tests for assets/js/chatbot-rules.js -- mirrors
// python/tests/test_chatbot.py, including the two regex bugs found during
// manual smoke-testing (greedy-digit-eating filler, "held" not recognized).
import { test } from "node:test";
import assert from "node:assert/strict";

import { answer } from "../assets/js/chatbot-rules.js";

test("rate lookup captures full number, not last digit", () => {
  const reply = answer("what's the rendering rate at 190?");
  assert.ok(reply.includes("190"));
  assert.ok(!reply.includes("at 0F"));
});

test("rate lookup handles 'how fast' phrasing", () => {
  const reply = answer("how fast does it render at 205");
  assert.ok(reply.includes("205"));
});

test("pulled + held (past tense) is recognized", () => {
  const reply = answer("I pulled at 195 and held at 150 for 14 hours, is it done?");
  assert.ok(!reply.includes("don't have a documented cooldown"));
  assert.ok(reply.includes("%"));
});

test("pulled + holding (present participle) is recognized", () => {
  const reply = answer("pulled at 195, holding at 150 for 18 hours");
  assert.ok(reply.includes("%"));
});

test("unknown pull temp gives honest fallback, not a crash", () => {
  const reply = answer("I pulled at 170 and held at 170 for 18 hours");
  assert.ok(reply.includes("don't have a documented cooldown"));
});

test("hours-needed phrasing", () => {
  const reply = answer("how many hours from 90% to 100% at 150?");
  assert.ok(reply.includes("150") && reply.includes("%"));
});

test("greeting / about / safety smoke test", () => {
  assert.ok(answer("is this safe?").includes("135"));
  assert.ok(answer("who is steve gow").toLowerCase().includes("steve gow"));
});

test("fallback does not crash on gibberish", () => {
  const reply = answer("asdkjfh qwoeiruqwoiuer");
  assert.equal(typeof reply, "string");
  assert.ok(reply.length > 0);
});
