// ui.js -- wires up the DOM: tabs and the Ask Steve chat (gated behind a
// status bar). With inference now server-side (Cloudflare Workers AI via
// our own Pages Function), "loading" is just a quick reachability check
// instead of a multi-hundred-MB in-browser model download.

import { aiAnswer, checkBackendReady } from "./chatbot-api.js";

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
    btn.classList.add("is-active");
    btn.setAttribute("aria-selected", "true");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("is-active");
    if (btn.dataset.tab === "chat") ensureBackendReady();
  });
});

// ---------- Chat ----------
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send");
const aiModelSelect = document.getElementById("ai-model-select");
const aiStatusEl = document.getElementById("ai-mode-status");
const progressFillEl = document.getElementById("ai-progress-fill");

const history = [];
let loadState = "idle"; // idle | loading | ready | error

function setChatEnabled(enabled) {
  chatInput.disabled = !enabled;
  chatSendBtn.disabled = !enabled;
  chatInput.placeholder = enabled ? "e.g. I pulled at 195 and held at 150 for 14 hours, is it done?" : "Connecting…";
}

function appendMessage(who, text) {
  const div = document.createElement("div");
  div.className = `chat-msg ${who === "You" ? "user" : "bot"}`;
  div.innerHTML = `<span class="who">${who}</span>${text.replace(/</g, "&lt;")}`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

async function ensureBackendReady() {
  if (loadState === "ready" || loadState === "loading") return;

  loadState = "loading";
  setChatEnabled(false);
  progressFillEl.classList.add("indeterminate");
  aiStatusEl.classList.remove("clickable-retry");
  aiStatusEl.textContent = "Connecting to Steve's brain…";

  try {
    await checkBackendReady();
    loadState = "ready";
    progressFillEl.classList.remove("indeterminate");
    progressFillEl.style.width = "100%";
    aiStatusEl.textContent = "Ready. Ask away.";
    setChatEnabled(true);
    chatInput.focus();
  } catch (err) {
    loadState = "error";
    progressFillEl.classList.remove("indeterminate");
    progressFillEl.style.width = "0%";
    aiStatusEl.textContent = `Couldn't reach the chat backend: ${err.message}. Click to retry.`;
    aiStatusEl.classList.add("clickable-retry");
    setChatEnabled(false);
  }
}

// Clicking the status text retries a failed connection.
aiStatusEl.addEventListener("click", () => {
  if (loadState === "error") {
    loadState = "idle";
    ensureBackendReady();
  }
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (loadState !== "ready") return;
  const msg = chatInput.value.trim();
  if (!msg) return;
  appendMessage("You", msg);
  chatInput.value = "";
  history.push({ role: "user", content: msg });

  const thinkingBubble = appendMessage("Steve", "...thinking...");
  setChatEnabled(false);
  try {
    const reply = await aiAnswer(msg, history, aiModelSelect.value);
    thinkingBubble.innerHTML = `<span class="who">Steve</span>${reply.replace(/</g, "&lt;")}`;
    history.push({ role: "assistant", content: reply });
  } catch (err) {
    thinkingBubble.innerHTML = `<span class="who">Steve</span>Error: ${err.message}`;
  } finally {
    setChatEnabled(true);
    chatInput.focus();
  }
});

// If the chat tab is already the active one on load (it's the default),
// start the reachability check right away instead of waiting for a click.
if (document.getElementById("tab-chat").classList.contains("is-active")) {
  ensureBackendReady();
}

// ---------- Footer repo link (best effort, harmless if unknown) ----------
const repoLink = document.getElementById("repo-link");
if (repoLink && location.hostname.endsWith("github.io")) {
  const [user] = location.hostname.split(".");
  const repo = location.pathname.split("/").filter(Boolean)[0];
  if (user && repo) repoLink.href = `https://github.com/${user}/${repo}`;
}
