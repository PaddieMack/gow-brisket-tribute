// Cloudflare Pages Function: /api/chat
//
// Server-side proxy to Workers AI. This is the reason the chat no longer
// needs to download a model into the browser -- inference runs on
// Cloudflare's GPUs and comes back over a normal HTTP request. No API key
// is exposed to the client; the AI binding below is configured entirely
// server-side (wrangler.toml's [ai] section / the Pages dashboard).
//
// Trade-off, documented in the README: chat messages now leave the user's
// browser and are processed by Cloudflare Workers AI, unlike the previous
// fully client-side WebLLM setup.
//
// CORS is enabled for a small allowlist so the SAME frontend can be served
// from GitHub Pages, Cloudflare Pages, or localhost and still reach this
// one Cloudflare-hosted API.

const ALLOWED_MODELS = new Set([
  "@cf/meta/llama-3.2-3b-instruct",
  "@cf/meta/llama-3.1-8b-instruct-fp8",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
]);
const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const MAX_MESSAGES = 20;
const MAX_CHARS_PER_MESSAGE = 2000;

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/([a-z0-9-]+\.)*gow-brisket-tribute\.pages\.dev$/, // production + preview deploys
  /^https:\/\/paddiemack\.github\.io$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const cors = corsHeaders(context.request);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400, cors);
  }

  const { messages, model } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError("`messages` must be a non-empty array", 400, cors);
  }
  if (messages.length > MAX_MESSAGES) {
    return jsonError(`Too many messages (max ${MAX_MESSAGES})`, 400, cors);
  }
  for (const m of messages) {
    if (
      typeof m !== "object" ||
      !["system", "user", "assistant"].includes(m.role) ||
      typeof m.content !== "string" ||
      m.content.length > MAX_CHARS_PER_MESSAGE
    ) {
      return jsonError("Each message needs a valid role and content", 400, cors);
    }
  }

  const modelId = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;

  try {
    const result = await context.env.AI.run(modelId, {
      messages,
      max_tokens: 300,
      temperature: 0.6,
    });
    return Response.json({ response: result.response ?? "", model: modelId }, { headers: cors });
  } catch (err) {
    return jsonError(`Workers AI error: ${err.message}`, 502, cors);
  }
}

export async function onRequestGet(context) {
  return Response.json(
    {
      ok: true,
      models: [...ALLOWED_MODELS],
      note: "POST { messages: [{role, content}, ...], model? } to chat.",
    },
    { headers: corsHeaders(context.request) }
  );
}

function jsonError(message, status, cors) {
  return Response.json({ error: message }, { status, headers: cors });
}
