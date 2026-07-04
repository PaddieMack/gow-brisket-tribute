// Integration test: loads the real index.html into jsdom, imports the real
// ui.js against it, and drives actual DOM events -- this catches wiring
// bugs (wrong element ids, listeners not attached, etc.) that a plain
// syntax check or pure-function unit test can't.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");

test("index.html + ui.js: full wiring smoke test", async () => {
  const dom = new JSDOM(html, {
    url: "https://example.github.io/gow-brisket-tribute/",
    runScripts: "outside-only",
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  // Node 21+ ships a read-only built-in `navigator` global, so a plain
  // assignment throws -- override it with defineProperty instead.
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  globalThis.location = dom.window.location;

  // cache-bust so re-running this test file's module cache isn't an issue
  await import(`../assets/js/ui.js?t=${Date.now()}`);

  // --- reference tables populated from the real model data ---
  const rateRows = document.querySelectorAll("#rate-table tr");
  assert.ok(rateRows.length >= 11, "rate table should have a header + 11 rate rows");

  const confirmedItems = document.querySelectorAll("#confirmed-methods-list li");
  assert.equal(confirmedItems.length, 4);

  // --- default state: spreadsheet worked example pre-loaded ---
  assert.equal(document.getElementById("result-percent").textContent, "101.5%");
  assert.equal(document.getElementById("result-texture").textContent, "PERFECTLY TENDER");
  assert.ok(document.getElementById("safety-note").textContent.includes("135"));

  // --- tab switching ---
  const chatTabBtn = document.querySelector('[data-tab="chat"]');
  chatTabBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.ok(document.getElementById("tab-chat").classList.contains("is-active"));
  assert.ok(!document.getElementById("tab-calculator").classList.contains("is-active"));

  // --- rule-based chat responds through the real form ---
  const chatInput = document.getElementById("chat-input");
  chatInput.value = "what's the rendering rate at 190?";
  document
    .getElementById("chat-form")
    .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const botMessages = document.querySelectorAll(".chat-msg.bot");
  const lastBotMsg = botMessages[botMessages.length - 1];
  assert.ok(lastBotMsg.textContent.includes("190"));

  // --- clear + manually add a zone row, recalculation updates live ---
  document.querySelector('[data-tab="calculator"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  document.getElementById("preset-clear").dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(document.getElementById("result-percent").textContent, "0.0%");

  document.getElementById("add-zone").dispatchEvent(new window.Event("click", { bubbles: true }));
  const row = document.querySelector(".zone-row");
  const tempInput = row.querySelector(".zone-temp");
  const hoursInput = row.querySelector(".zone-hours");
  tempInput.value = "190";
  tempInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  hoursInput.value = "2";
  hoursInput.dispatchEvent(new window.Event("input", { bubbles: true }));

  assert.equal(document.getElementById("result-percent").textContent, "36.0%"); // 18%/hr * 2hr

  // --- remove the zone row, back to zero ---
  row.querySelector(".remove-zone").dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(document.getElementById("result-percent").textContent, "0.0%");

  // --- interpolated mode toggle recalculates ---
  document.getElementById("add-zone").dispatchEvent(new window.Event("click", { bubbles: true }));
  const row2 = document.querySelector(".zone-row");
  row2.querySelector(".zone-temp").value = "155";
  row2.querySelector(".zone-temp").dispatchEvent(new window.Event("input", { bubbles: true }));
  row2.querySelector(".zone-hours").value = "1";
  row2.querySelector(".zone-hours").dispatchEvent(new window.Event("input", { bubbles: true }));
  const zoneModeResult = document.getElementById("result-percent").textContent;

  document.querySelector('input[name="mode"][value="interpolated"]').checked = true;
  document
    .querySelector('input[name="mode"][value="interpolated"]')
    .dispatchEvent(new window.Event("change", { bubbles: true }));
  const interpModeResult = document.getElementById("result-percent").textContent;
  assert.notEqual(zoneModeResult, interpModeResult);
});
