// chatbot-llm.js -- the chat's only brain: a real open-source LLM running
// entirely in the browser via WebGPU, using WebLLM (MLC-AI). No server, no
// API key, nothing leaves the user's machine.
//
// Numeric questions are grounded with a deterministic fact first (see
// grounding.js, which reuses the same tested calculator engine as the
// Python port) so answers about rendering rates / hold times / percent
// done are computed, not guessed by the LLM. The LLM only handles
// conversational framing and anything outside that computable set.

import { MODEL, credit } from "./model.js";
import { extractGroundedFact } from "./grounding.js";

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

  return [
    `You are a fan-made tribute chatbot inspired by "${c.method_name}" by ${c.author} (${c.source}).`,
    `You are NOT actually Steve Gow and should say so if asked directly whether you are him.`,
    `Speak in a friendly, practical pitmaster voice. Keep answers short (2-5 sentences) unless asked for detail.`,
    `Core idea of the model: collagen rendering into gelatin depends on BOTH time and temperature, and increases`,
    `EXPONENTIALLY with temperature -- so the hold is part of the cook, not just a rest.`,
    `Rendering rate table (% collagen rendered per hour, at internal temp): ${rates}. Below 135F, rendering is ~0.`,
    `Texture bands by cumulative Percent Done: <80% Underdone, 80-95% Slightly Underdone, 95-110% PERFECTLY TENDER`,
    `(the target range), 110-120% Slightly Over, >120% Overdone/risk of mushy.`,
    `Food safety: ${MODEL.food_safety_note}`,
    `IMPORTANT: you are not reliable at precise arithmetic. Sometimes a "COMPUTED FACT" system message will be`,
    `included alongside the user's question -- it was calculated by a real deterministic calculator, not by you.`,
    `When present, treat it as ground truth and build your reply around those exact numbers. When absent and the`,
    `user asks something numeric, only give rough ballpark language ("roughly", "in the neighborhood of") and be`,
    `upfront that it's an estimate -- never state a precise-sounding percent or hour count you computed yourself.`,
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
      "This browser doesn't expose WebGPU, so the chat can't run here. Try a recent desktop Chrome or Edge."
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
 * Ask the loaded LLM a question. Runs the deterministic grounding check
 * first; if it recognizes a computable question, the computed fact is
 * injected as extra system context so the reply is numerically accurate.
 * history: [{role: "user"|"assistant", content: string}, ...]
 */
export async function aiAnswer(userMessage, history = []) {
  if (!engine) {
    throw new Error("The model isn't loaded yet.");
  }
  const groundedFact = extractGroundedFact(userMessage);
  const messages = [
    { role: "system", content: buildSystemPrompt() },
    ...history.slice(-8),
    ...(groundedFact ? [{ role: "system", content: groundedFact }] : []),
    { role: "user", content: userMessage },
  ];
  const reply = await engine.chat.completions.create({
    messages,
    temperature: 0.6,
    max_tokens: 300,
  });
  return reply.choices[0]?.message?.content ?? "(no response)";
}
