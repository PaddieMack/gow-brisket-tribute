// ui.js -- wires up the DOM: tabs, calculator zone rows, live results,
// chart, reference tables, and the Ask Steve chat (rule-based + optional
// AI Mode).

import {
  MODEL,
  evaluate,
  projectTimeline,
  workedExample,
  documentedCaseStudies,
  confirmedMethods,
} from "./model.js";
import { answer as rulesAnswer, FALLBACK_TEXT } from "./chatbot-rules.js";
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
  });
});

// ---------- Calculator ----------
const zoneRowsEl = document.getElementById("zone-rows");
const addZoneBtn = document.getElementById("add-zone");
const resultPercentEl = document.getElementById("result-percent");
const resultTextureEl = document.getElementById("result-texture");
const resultRemainingEl = document.getElementById("result-remaining");
const safetyNoteEl = document.getElementById("safety-note");

safetyNoteEl.textContent = MODEL.food_safety_note;

function currentMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function addZoneRow(tempF = "", hours = "") {
  const row = document.createElement("div");
  row.className = "zone-row";
  row.innerHTML = `
    <input type="number" class="zone-temp" placeholder="Temp (F)" value="${tempF}" step="1" />
    <input type="number" class="zone-hours" placeholder="Hours" value="${hours}" step="0.25" min="0" />
    <button type="button" class="remove-zone" aria-label="Remove zone">&times;</button>
  `;
  row.querySelector(".remove-zone").addEventListener("click", () => {
    row.remove();
    recalculate();
  });
  row.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", recalculate));
  zoneRowsEl.appendChild(row);
}

function readZones() {
  const entries = [];
  zoneRowsEl.querySelectorAll(".zone-row").forEach((row) => {
    const temp = parseFloat(row.querySelector(".zone-temp").value);
    const hours = parseFloat(row.querySelector(".zone-hours").value);
    if (!Number.isNaN(temp) && !Number.isNaN(hours) && hours > 0) {
      entries.push({ temp_f: temp, hours });
    }
  });
  return entries;
}

function textureClass(texture) {
  if (texture === "PERFECTLY TENDER") return "good";
  if (texture === "Underdone" || texture === "Slightly Underdone") return "warn";
  return texture === "Slightly Over" ? "warn" : "bad";
}

let chart = null;

function updateChart(entries, mode) {
  const canvas = document.getElementById("rendering-chart");
  if (typeof window.Chart === "undefined" || entries.length === 0) {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    return;
  }
  const timeline = projectTimeline(entries, mode);
  const labels = ["0", ...timeline.map((t) => t.cumulativeHours.toFixed(1))];
  const data = [0, ...timeline.map((t) => t.cumulativePercent)];

  if (chart) chart.destroy();
  chart = new window.Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Cumulative % Done",
          data,
          borderColor: "#ff7a1a",
          backgroundColor: "rgba(255,122,26,0.15)",
          fill: true,
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: "Cumulative hours", color: "#b6a89a" }, ticks: { color: "#b6a89a" }, grid: { color: "#3a2f27" } },
        y: { title: { display: true, text: "% Done", color: "#b6a89a" }, ticks: { color: "#b6a89a" }, grid: { color: "#3a2f27" } },
      },
      plugins: { legend: { labels: { color: "#f1e9df" } } },
    },
  });
}

function recalculate() {
  const mode = currentMode();
  const entries = readZones();
  const result = evaluate(entries, mode);

  resultPercentEl.textContent = `${result.totalPercent.toFixed(1)}%`;
  resultTextureEl.textContent = result.texture;
  resultTextureEl.className = `texture-pill ${textureClass(result.texture)}`;
  resultRemainingEl.textContent =
    result.remainingTo100 > 0 ? `${result.remainingTo100.toFixed(1)}% remaining to 100%` : "At or past 100% done";

  updateChart(entries, mode);
}

document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", recalculate));
addZoneBtn.addEventListener("click", () => addZoneRow());

function loadEntriesIntoForm(entries) {
  zoneRowsEl.innerHTML = "";
  entries.forEach((e) => addZoneRow(e.temp_f, e.hours));
  recalculate();
}

document.getElementById("preset-worked-example").addEventListener("click", () => {
  const ex = workedExample();
  loadEntriesIntoForm([...ex.cook_zone_hours, ...ex.hold_zone_hours]);
});
document.getElementById("preset-case-study").addEventListener("click", () => {
  const [cs] = documentedCaseStudies();
  loadEntriesIntoForm([...cs.cook_zone_hours, ...cs.hold_zone_hours]);
});
document.getElementById("preset-clear").addEventListener("click", () => loadEntriesIntoForm([]));

// Start with the spreadsheet's own worked example loaded so the page is
// never empty/confusing on first load.
{
  const ex = workedExample();
  loadEntriesIntoForm([...ex.cook_zone_hours, ...ex.hold_zone_hours]);
}

// ---------- Reference tables ----------
const rateTableEl = document.getElementById("rate-table");
rateTableEl.innerHTML =
  "<tr><th>Temp (F)</th><th>%/hr</th></tr>" +
  MODEL.rendering_rates
    .slice()
    .sort((a, b) => a.temp_f - b.temp_f)
    .map((r) => `<tr><td>${r.temp_f}°</td><td>${r.percent_per_hour}%</td></tr>`)
    .join("");

const confirmedListEl = document.getElementById("confirmed-methods-list");
confirmedListEl.innerHTML = confirmedMethods()
  .map(
    (m) =>
      `<li><strong>${m.pull_temp_f}°F</strong> pull (${m.pull_texture}) → hold <strong>${m.hold_temp_f}°F</strong> × ${m.hold_time_hours}hr</li>`
  )
  .join("");

// ---------- Chat ----------
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const enableAIBtn = document.getElementById("enable-ai-mode");
const aiModelSelect = document.getElementById("ai-model-select");
const aiStatusEl = document.getElementById("ai-mode-status");

let aiModeOn = false;
const history = [];

function appendMessage(who, text) {
  const div = document.createElement("div");
  div.className = `chat-msg ${who === "You" ? "user" : "bot"}`;
  div.innerHTML = `<span class="who">${who}</span>${text.replace(/</g, "&lt;")}`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

appendMessage(
  "Steve (tribute bot)",
  "Howdy! I'm a fan-made tribute bot grounded in the real Cook & Hold model. Ask me about rendering rates, hold times, or confirmed methods."
);

enableAIBtn.addEventListener("click", async () => {
  if (!isWebGPUSupported()) {
    aiStatusEl.textContent = "Your browser doesn't support WebGPU, so AI Mode isn't available here. Try a recent desktop Chrome or Edge.";
    return;
  }
  enableAIBtn.disabled = true;
  aiModelSelect.disabled = true;
  const modelId = aiModelSelect.value;
  aiStatusEl.textContent = "Loading model... this can take a while on first run (downloads once, then caches).";
  try {
    await initAIMode(modelId, ({ progress, text }) => {
      aiStatusEl.textContent = text || `Loading... ${Math.round(progress * 100)}%`;
    });
    aiModeOn = true;
    aiStatusEl.textContent = `AI Mode ready (${modelId}). Free-form questions now get an LLM-generated reply too.`;
    enableAIBtn.textContent = "AI Mode enabled";
  } catch (err) {
    aiStatusEl.textContent = `Couldn't load AI Mode: ${err.message}`;
    enableAIBtn.disabled = false;
    aiModelSelect.disabled = false;
  }
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  appendMessage("You", msg);
  chatInput.value = "";

  const reply = rulesAnswer(msg);
  appendMessage("Steve (rules)", reply);
  history.push({ role: "user", content: msg }, { role: "assistant", content: reply });

  if (aiModeOn && reply === FALLBACK_TEXT) {
    appendMessage("Steve (AI Mode)", "...thinking...");
    const thinkingBubble = chatLog.lastElementChild;
    try {
      const aiReply = await aiAnswer(msg, history);
      thinkingBubble.innerHTML = `<span class="who">Steve (AI Mode)</span>${aiReply.replace(/</g, "&lt;")}`;
    } catch (err) {
      thinkingBubble.innerHTML = `<span class="who">Steve (AI Mode)</span>Error: ${err.message}`;
    }
  }
});

// ---------- Footer repo link (best effort, harmless if unknown) ----------
const repoLink = document.getElementById("repo-link");
if (repoLink && location.hostname.endsWith("github.io")) {
  const [user] = location.hostname.split(".");
  const repo = location.pathname.split("/").filter(Boolean)[0];
  if (user && repo) repoLink.href = `https://github.com/${user}/${repo}`;
}
