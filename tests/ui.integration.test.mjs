// Integration test: loads the real index.html into jsdom, imports the real
// ui.js against it, and drives actual DOM events. jsdom has no WebGPU
// (navigator.gpu is undefined), so this deterministically exercises the
// "model can't load here, chat stays gated" path with zero network calls --
// a legitimate, meaningful test of the status-bar gating behavior itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");

test("index.html + ui.js: chat is gated until the model is ready", async () => {
  const dom = new JSDOM(html, {
    url: "https://example.github.io/gow-brisket-tribute/",
    runScripts: "outside-only",
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  globalThis.location = dom.window.location;

  await import(`../assets/js/ui.js?t=${Date.now()}`);

  // --- chat starts disabled, gated behind the (auto-triggered) load ---
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  assert.equal(chatInput.disabled, true);
  assert.equal(chatSend.disabled, true);

  // jsdom has no navigator.gpu, so the auto-triggered load synchronously
  // hits the "WebGPU unsupported" branch -- let one microtask tick pass.
  await Promise.resolve();
  await Promise.resolve();

  assert.match(document.getElementById("ai-mode-status").textContent, /WebGPU/);
  assert.equal(chatInput.disabled, true, "chat must stay disabled when the model can't load");
  assert.equal(chatSend.disabled, true);

  // --- submitting while gated is a no-op, not a silent broken send ---
  chatInput.disabled = false; // simulate a stale/bypassed client just in case
  chatInput.value = "will this send?";
  document
    .getElementById("chat-form")
    .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(document.querySelectorAll(".chat-msg").length, 0, "no message should be appended while gated");

  // --- tab switching still works with only two tabs now ---
  const aboutTabBtn = document.querySelector('[data-tab="about"]');
  aboutTabBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.ok(document.getElementById("tab-about").classList.contains("is-active"));
  assert.ok(!document.getElementById("tab-chat").classList.contains("is-active"));

  const chatTabBtn = document.querySelector('[data-tab="chat"]');
  chatTabBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.ok(document.getElementById("tab-chat").classList.contains("is-active"));

  // --- no calculator anywhere on the page anymore ---
  assert.equal(document.getElementById("tab-calculator"), null);
  assert.equal(document.querySelector(".zone-row"), null);
});
