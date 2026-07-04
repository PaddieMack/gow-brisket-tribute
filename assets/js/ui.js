// ui.js -- wires up the DOM: tabs and the Ask Steve chat (gated behind a
// real loading status bar; chat is disabled until the model finishes
// loading). No calculator UI here on purpose -- Steve's own site already
// has one; see the About tab.

import { initAIMode, aiAnswer, isWebGPUSupported } from "./chatbot-llm.js";

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
    if (btn.dataset.tab === "chat") ensureModelLoaded();
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
let loadedFor = null;

function setProgress(fraction) {
  progressFillEl.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
}

function setChatEnabled(enabled) {
  chatInput.disabled = !enabled;
  chatSendBtn.disabled = !enabled;
  chatInput.placeholder = enabled ? "e.g. I pulled at 195 and held at 150 for 14 hours, is it done?" : "Loading model before chat is enabled…";
}

function appendMessage(who, text) {
  const div = document.createElement("div");
  div.className = `chat-msg ${who === "You" ? "user" : "bot"}`;
  div.innerHTML = `<span class="who">${who}</span>${text.replace(/</g, "&lt;")}`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

async function ensureModelLoaded() {
  const modelId = aiModelSelect.value;
  if (loadState === "ready" && loadedFor === modelId) return;
  if (loadState === "loading") return;

  if (!isWebGPUSupported()) {
    loadState = "error";
    setProgress(0);
    aiStatusEl.textContent =
      "Your browser doesn't support WebGPU, so this chat can't run here. Try a recent desktop Chrome or Edge.";
    setChatEnabled(false);
    return;
  }

  loadState = "loading";
  setChatEnabled(false);
  aiModelSelect.disabled = true;
  setProgress(0);
  aiStatusEl.textContent = "Loading model… this can take a while on first run (downloads once, then caches).";

  try {
    await initAIMode(modelId, ({ progress, text }) => {
      setProgress(progress);
      aiStatusEl.textContent = text || `Loading… ${Math.round(progress * 100)}%`;
    });
    loadState = "ready";
    loadedFor = modelId;
    setProgress(1);
    aiStatusEl.textContent = `Ready (${modelId}). Ask away.`;
    setChatEnabled(true);
    chatInput.focus();
  } catch (err) {
    loadState = "error";
    aiStatusEl.textContent = `Couldn't load the model: ${err.message}`;
    setChatEnabled(false);
  } finally {
    aiModelSelect.disabled = false;
  }
}

aiModelSelect.addEventListener("change", () => {
  loadState = "idle";
  ensureModelLoaded();
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
    const reply = await aiAnswer(msg, history);
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
// start loading right away instead of waiting for a tab click.
if (document.getElementById("tab-chat").classList.contains("is-active")) {
  ensureModelLoaded();
}

// ---------- Footer repo link (best effort, harmless if unknown) ----------
const repoLink = document.getElementById("repo-link");
if (repoLink && location.hostname.endsWith("github.io")) {
  const [user] = location.hostname.split(".");
  const repo = location.pathname.split("/").filter(Boolean)[0];
  if (user && repo) repoLink.href = `https://github.com/${user}/${repo}`;
}
