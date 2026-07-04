// chatbot-llm.js -- optional "AI Mode": a real open-source LLM running
// entirely in the browser via WebGPU, using WebLLM (MLC-AI). No server, no
// API key, nothing leaves the user's machine. Lazy-loaded only when the
// user explicitly clicks "Enable AI Mode", since the model weights are a
// meaningful download (hundreds of MB to ~1.3GB depending on choice).
//
// The LLM is only used for free-form conversation/persona flavor. Any
// message the deterministic rule-based responder (chatbot-rules.js) can
// already answer confidently is handled there instead -- we never let the
// LLM compute a rendering percentage itself, since language models are
// unreliable at arithmetic and this is a food-safety-adjacent tool.

import { MODEL, credit } from "./model.js";

let engine = null;
let loadedModelId = null;

export function isWebGPUSupported() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

function buildSystemPrompt() {
  const c = credit();
  const rates = MODEL.rendering_rates
    .map((r) => `${r.temp_f}F = ${r.percent_per_hour}%/hr`)
    .join(", ");
  const methods = MODEL.confirmed_methods
    .map(
      (m) =>
        `~${m.hours_on_smoker_plus_minus_2}hr smoker -> ${m.pull_temp_f}F (${m.pull_texture}), hold ${m.hold_temp_f}F x ${m.hold_time_hours}hr`
    )
    .join("; ");

  return [
    `You are a fan-made tribute chatbot inspired by "${c.method_name}" by ${c.author} (${c.source}).`,
    `You are NOT actually Steve Gow and should say so if asked directly whether you are him.`,
    `Speak in a friendly, practical pitmaster voice. Keep answers short (2-5 sentences) unless asked for detail.`,
    `Core idea of the model: collagen rendering into gelatin depends on BOTH time and temperature, and increases`,
    `EXPONENTIALLY with temperature -- so the hold is part of the cook, not just a rest.`,
    `Rendering rate table (% collagen rendered per hour, at internal temp): ${rates}. Below 135F, rendering is ~0.`,
    `Texture bands by cumulative Percent Done: <80% Underdone, 80-95% Slightly Underdone, 95-110% PERFECTLY TENDER`,
    `(the target range), 110-120% Slightly Over, >120% Overdone/risk of mushy.`,
    `Steve's confirmed real-world methods: ${methods}.`,
    `Food safety: ${MODEL.food_safety_note}`,
    `IMPORTANT: you are not reliable at precise arithmetic. For any specific numeric calculation (total percent`,
    `done, hours needed, etc.) tell the user to use the calculator tab on this page instead of computing it`,
    `yourself, or only give rough ballpark language ("roughly", "in the neighborhood of").`,
    `Always credit Steve Gow / Smoke Trails BBQ (${c.article_url}) if asked where this comes from.`,
  ].join(" ");
}

/**
 * Load (or return the already-loaded) WebLLM engine for a given model id.
 * onProgress receives {progress: 0..1, text} updates during download/init.
 */
export async function initAIMode(modelId, onProgress) {
  if (!isWebGPUSupported()) {
    throw new Error(
      "This browser doesn't expose WebGPU, so in-browser AI Mode isn't available. Try a recent desktop Chrome or Edge."
    );
  }
  if (engine && loadedModelId === modelId) {
    return engine;
  }

  // Loaded from CDN as an ES module -- no build step, no npm install,
  // works straight from a static GitHub Pages deployment.
  const webllm = await import("https://esm.run/@mlc-ai/web-llm");

  engine = await webllm.CreateMLCEngine(modelId, {
    initProgressCallback: (report) => {
      onProgress?.({ progress: report.progress ?? 0, text: report.text ?? "" });
    },
  });
  loadedModelId = modelId;
  return engine;
}

export function isAIModeReady() {
  return !!engine;
}

/**
 * Ask the loaded LLM a free-form question, with the model's data baked
 * into the system prompt and recent chat history for context.
 * history: [{role: "user"|"assistant", content: string}, ...]
 */
export async function aiAnswer(userMessage, history = []) {
  if (!engine) {
    throw new Error("AI Mode isn't loaded yet.");
  }
  const messages = [
    { role: "system", content: buildSystemPrompt() },
    ...history.slice(-8),
    { role: "user", content: userMessage },
  ];
  const reply = await engine.chat.completions.create({
    messages,
    temperature: 0.6,
    max_tokens: 300,
  });
  return reply.choices[0]?.message?.content ?? "(no response)";
}
