// chatbot-api.js -- the chat's brain, now served by Cloudflare Workers AI
// through our own Pages Function (functions/api/chat.js) instead of an
// in-browser WebLLM model. This trades away "nothing ever leaves your
// machine" for near-instant responses and no multi-hundred-MB download:
// chat messages are sent to our Cloudflare Pages deployment, which calls
// Workers AI server-side. No API key is ever exposed to the browser.
//
// Numeric questions are still grounded with a deterministic fact first
// (see grounding.js, which reuses the same tested calculator engine as the
// Python port) so answers about rendering rates / hold times / percent
// done are computed, not guessed by the LLM.

import { MODEL, credit } from "./model.js";
import { extractGroundedFact } from "./grounding.js";

// Always call the production Cloudflare Pages deployment directly, even
// when this page itself is served from elsewhere (e.g. GitHub Pages) --
// that keeps a single frontend codebase working from any host. The
// Function sets CORS headers for the specific origins this is deployed to.
const API_BASE = "https://gow-brisket-tribute.pages.dev";

export const AVAILABLE_MODELS = [
  { id: "@cf/meta/llama-3.2-3b-instruct", label: "Llama 3.2 3B (fastest)" },
  { id: "@cf/meta/llama-3.1-8b-instruct-fp8", label: "Llama 3.1 8B (balanced)" },
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B (best quality)" },
];
export const DEFAULT_MODEL = AVAILABLE_MODELS[1].id;

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

/** Quick reachability/health check against our own API -- this is the
 * whole "loading" phase now (no model download), so it should resolve in
 * well under a second when everything's healthy. */
export async function checkBackendReady() {
  const res = await fetch(`${API_BASE}/api/chat`, { method: "GET" });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error("Backend did not report ready");
  return data;
}

/**
 * Ask the model a question. Runs the deterministic grounding check first;
 * if it recognizes a computable question, the computed fact is injected as
 * extra system context so the reply is numerically accurate.
 * history: [{role: "user"|"assistant", content: string}, ...]
 */
export async function aiAnswer(userMessage, history = [], modelId = DEFAULT_MODEL) {
  const groundedFact = extractGroundedFact(userMessage);
  const messages = [
    { role: "system", content: buildSystemPrompt() },
    ...history.slice(-8),
    ...(groundedFact ? [{ role: "system", content: groundedFact }] : []),
    { role: "user", content: userMessage },
  ];

  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, model: modelId }),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Bad response from server (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(data.error || `Server error (${res.status})`);
  }
  return data.response;
}
