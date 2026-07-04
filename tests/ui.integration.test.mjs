// Integration test: loads the real docs/index.html into jsdom, imports the
// real ui.js against it, and drives actual DOM events. global.fetch is
// mocked so this stays deterministic and offline -- it never hits the real
// Cloudflare deployment -- while still exercising the real request/response
// shape the frontend expects from functions/api/chat.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf-8");

function installDom() {
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
  return dom;
}

async function waitFor(predicate, { timeout = 1000, interval = 5 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`waitFor: condition not met within ${timeout}ms`);
}

test("index.html + ui.js: backend healthy -> chat becomes enabled and round-trips a reply", async () => {
  installDom();

  let call = 0;
  globalThis.fetch = async (url, opts) => {
    call += 1;
    if (!opts || opts.method === "GET") {
      // GET health check
      return { ok: true, json: async () => ({ ok: true, models: ["@cf/meta/llama-3.1-8b-instruct-fp8"] }) };
    }
    // POST chat
    const body = JSON.parse(opts.body);
    assert.ok(Array.isArray(body.messages) && body.messages.length > 0);
    return { ok: true, json: async () => ({ response: "Howdy, that sounds about right.", model: body.model }) };
  };

  await import(`../docs/assets/js/ui.js?t=${Date.now()}`);

  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  await waitFor(() => chatInput.disabled === false);
  assert.equal(chatSend.disabled, false);
  assert.match(document.getElementById("ai-mode-status").textContent, /Ready/);

  chatInput.value = "what's the rendering rate at 190?";
  document
    .getElementById("chat-form")
    .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(() => document.querySelectorAll(".chat-msg.bot").length > 0 && !document.querySelector(".chat-msg.bot")?.textContent.includes("...thinking..."));

  const botMessages = document.querySelectorAll(".chat-msg.bot");
  const lastBotMsg = botMessages[botMessages.length - 1];
  await waitFor(() => lastBotMsg.textContent.includes("Howdy"));
  assert.ok(call >= 2, "expected both the health check and the chat POST to fire");
});

test("index.html + ui.js: backend unreachable -> chat stays gated with a clear error", async () => {
  installDom();

  globalThis.fetch = async () => {
    throw new Error("network down");
  };

  await import(`../docs/assets/js/ui.js?t=${Date.now()}`);

  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  await waitFor(() => document.getElementById("ai-mode-status").textContent.includes("Couldn't reach"));
  assert.equal(chatInput.disabled, true);
  assert.equal(chatSend.disabled, true);

  // submitting while gated is a no-op
  chatInput.disabled = false;
  chatInput.value = "will this send?";
  document
    .getElementById("chat-form")
    .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(document.querySelectorAll(".chat-msg").length, 0, "no message should be appended while gated");

  // --- tab switching still works with only two tabs ---
  const aboutTabBtn = document.querySelector('[data-tab="about"]');
  aboutTabBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.ok(document.getElementById("tab-about").classList.contains("is-active"));

  // --- no calculator anywhere on the page ---
  assert.equal(document.getElementById("tab-calculator"), null);
  assert.equal(document.querySelector(".zone-row"), null);
});
