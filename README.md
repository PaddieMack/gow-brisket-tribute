# Ask Steve — Brisket Cook & Hold Tribute

An unofficial fan tribute to **Steve Gow**'s Brisket "Cook & Hold" Tenderness
Model, published on [Smoke Trails BBQ](https://smoketrailsbbq.com/) — a
chatbot grounded in his actual model, answered by a real open-source LLM.

> This project is not affiliated with or endorsed by Steve Gow or Smoke
> Trails BBQ. Every fact this bot is grounded in is transcribed directly
> from his own published work — please go visit the real thing:

- **Website:** [smoketrailsbbq.com](https://smoketrailsbbq.com/)
- **Original article:** [Brisket Holding Masterclass (And Tenderness Model)](https://smoketrailsbbq.com/brisket-holding-masterclass-and-tenderness-model/) — this is also where **his own calculator spreadsheet** lives; this project doesn't reimplement that UI, just the chat.
- **Video:** ["The Science of Brisket Tenderness (And Perfect Hold Time)"](https://www.youtube.com/watch?v=lplpPCU5UNQ&t=1203s) on YouTube
- **YouTube channel:** [@SmokeTrailsBBQ](https://www.youtube.com/@SmokeTrailsBBQ)
- **Rubs & shop:** [Smoke Trails BBQ Brisket Rub](https://smoketrailsbbq.com/product/smoke-trails-bbq-brisket-rub/), [General Purpose Rub](https://smoketrailsbbq.com/product/smoke-trails-bbq-lets-gow-general-purpose-rub/)

**Live:** https://gow-brisket-tribute.pages.dev (also mirrored at https://paddiemack.github.io/gow-brisket-tribute/ — same frontend, same backend, see [Architecture](#architecture))

## The idea, in one sentence

Collagen turns into gelatin at a rate that grows **exponentially** with
internal temperature, so the hold isn't just a rest — it's part of the cook.
Steve built a simple "% rendered per hour" table for each 10°F zone,
validated it against real brisket cooks, and published a spreadsheet
calculator on his own site. This repo doesn't duplicate that calculator —
it's a chatbot tribute that uses a tested port of the same math to ground
an LLM's answers.

## What's in here

```
data/rendering_model.json     canonical model data, extracted from Steve's spreadsheet
tools/extract_model.py        the extractor (xlsx -> JSON + a JS data module)
python/brisket_model/         tested Python port of the math (model + calculator, no chat/CLI)
python/tests/                 pytest suite, pinned to two of Steve's own worked examples
docs/                         the static frontend (HTML/CSS/JS) -- served by both hosts, see below
functions/api/chat.js         Cloudflare Pages Function -- proxies chat to Workers AI
wrangler.toml                 Cloudflare Pages config (build output dir + AI binding)
tests/                        Node test suite (unit tests + a jsdom DOM integration test, fetch mocked)
```

## Architecture

The chat used to run a small open-source model entirely in-browser via
WebLLM/WebGPU. That kept everything private (nothing left the browser) but
meant a multi-hundred-MB download before the first message could be sent.
This version trades that for **near-instant responses**: inference now runs
server-side on **Cloudflare Workers AI**, called through a small Pages
Function (`functions/api/chat.js`) that ships with this repo. No API key is
ever exposed to the browser — the AI binding is configured entirely
server-side.

**Trade-off, stated plainly:** chat messages now leave the browser and are
processed by Cloudflare to generate a reply. This is no longer a fully
local/private chat the way the WebLLM version was.

One static frontend (`docs/`), two hosts:

- **Cloudflare Pages** (`gow-brisket-tribute.pages.dev`) — same-origin, so
  the frontend calls `/api/chat` and gets the Function directly.
- **GitHub Pages** (`paddiemack.github.io/gow-brisket-tribute`) — a second
  copy of the *same* `docs/` folder (GitHub Pages source is set to `/docs`).
  The frontend calls the full Cloudflare Pages URL cross-origin; the
  Function allow-lists that origin for CORS. No duplicated code, both hosts
  fully functional.

Numeric questions (rendering rate at a temp, hours needed to hit a target
percent, "I pulled at 195 and held at 150 for 14 hours, is it done?") are
intercepted client-side by a deterministic grounding layer
(`docs/assets/js/grounding.js`) that computes the exact answer with the same
tested calculator engine as the Python port, and hands that computed fact to
the LLM as context. The model only supplies conversational framing — it
never does the arithmetic itself, so the numbers you see are deterministic,
not guessed. There is deliberately **no calculator UI** — Steve's own site
already has one.

## Deploying

### Cloudflare Pages (the API-serving host)

```bash
npm install
npx wrangler login
npx wrangler pages project create gow-brisket-tribute
npx wrangler pages deploy docs --project-name=gow-brisket-tribute
```

`wrangler.toml` declares the Workers AI binding (`[ai] binding = "AI"`) and
`pages_build_output_dir = "docs"`, so the Function and the AI binding both
come along automatically — no dashboard clicking required.

Allowed models live in an allowlist in `functions/api/chat.js` (`llama-3.2-3b-instruct`,
`llama-3.1-8b-instruct-fp8`, `llama-3.3-70b-instruct-fp8-fast` at the time of
writing) — check the [Workers AI model catalog](https://developers.cloudflare.com/workers-ai/models/)
for what's current if you change these, since Cloudflare periodically adds/deprecates models.

### GitHub Pages (mirror)

**Settings → Pages → Deploy from a branch → `main` → `/docs`.** If you fork
this and deploy your own Cloudflare Pages project, update `API_BASE` in
`docs/assets/js/chatbot-api.js` and the origin allowlist in
`functions/api/chat.js` to match your own domain.

## Running it locally

```bash
python3 -m http.server 8000 --directory docs
# visit http://localhost:8000 -- chat calls the live Cloudflare deployment
# (add http://localhost:8000 to the CORS allowlist in functions/api/chat.js,
# already included by default for localhost)
```

To test the Function itself locally against real Workers AI (this still
hits your Cloudflare account and incurs normal usage):

```bash
npx wrangler pages dev docs --ai=AI
```

### Python

The Python side is just the tested math library and the spreadsheet
extractor (no CLI, no chatbot) — it exists so the model itself has an
independently tested reference implementation, and so the JS port has
something to be checked against.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 -m pytest python/tests/ -v
```

### Regenerating the model data from a spreadsheet

If Steve ever publishes a new version of the calculator spreadsheet:

```bash
python3 tools/extract_model.py path/to/Holding-chart-with-Calculator.xlsx
```

This rewrites `data/rendering_model.json`, `docs/assets/data/rendering_model.json`,
and `docs/assets/js/data.generated.js` from the workbook's actual cells —
nothing is hand-typed, so the Python package and the web app can never
silently drift from the source.

### JavaScript

```bash
npm install
npm test     # unit tests for model.js + grounding.js, plus a jsdom integration test (fetch mocked, offline)
```

## Why keep a calculator engine if there's no calculator UI?

The chat still needs to answer numeric questions correctly, and LLMs are
unreliable at arithmetic. So the tested calculator (ported to both Python
and JS from Steve's spreadsheet) stays in the codebase as a **grounding
engine**: before the LLM sees a numeric question, a deterministic extractor
computes the real answer and injects it as context, so the LLM's reply
states a computed number instead of a guessed one. It's invisible to the
user — there's only ever one chat experience — but it's why the answers
that matter are deterministic under the hood.

## Data provenance

Every rendering rate, texture band, confirmed method, and cooldown pattern
in `data/rendering_model.json` is transcribed from either Steve Gow's
published spreadsheet or his own comment replies on the article (quoted
verbatim where used, e.g. the exact zone-by-zone breakdown he gave a reader
named Jack, which doubles as one of this repo's regression tests). See
`tools/extract_model.py` for exactly where each field comes from.
