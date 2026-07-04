# Ask Steve — Brisket Cook & Hold Tribute

An unofficial fan tribute to **Steve Gow**'s Brisket "Cook & Hold" Tenderness
Model, published on [Smoke Trails BBQ](https://smoketrailsbbq.com/) — a
chatbot that runs a real open-source LLM entirely in your browser, grounded
in his actual model.

> This project is not affiliated with or endorsed by Steve Gow or Smoke
> Trails BBQ. Every fact this bot is grounded in is transcribed directly
> from his own published work — please go visit the real thing:

- **Website:** [smoketrailsbbq.com](https://smoketrailsbbq.com/)
- **Original article:** [Brisket Holding Masterclass (And Tenderness Model)](https://smoketrailsbbq.com/brisket-holding-masterclass-and-tenderness-model/) — this is also where **his own calculator spreadsheet** lives; this project doesn't reimplement that UI, just the chat.
- **Video:** ["The Science of Brisket Tenderness (And Perfect Hold Time)"](https://www.youtube.com/watch?v=lplpPCU5UNQ&t=1203s) on YouTube
- **YouTube channel:** [@SmokeTrailsBBQ](https://www.youtube.com/@SmokeTrailsBBQ)
- **Rubs & shop:** [Smoke Trails BBQ Brisket Rub](https://smoketrailsbbq.com/product/smoke-trails-bbq-brisket-rub/), [General Purpose Rub](https://smoketrailsbbq.com/product/smoke-trails-bbq-lets-gow-general-purpose-rub/)

## The idea, in one sentence

Collagen turns into gelatin at a rate that grows **exponentially** with
internal temperature, so the hold isn't just a rest — it's part of the cook.
Steve built a simple "% rendered per hour" table for each 10°F zone,
validated it against real brisket cooks, and published a spreadsheet
calculator on his own site. This repo doesn't duplicate that calculator —
it's a chatbot tribute that uses a tested port of the same math to ground
an in-browser open-source LLM's answers.

## What's in here

```
data/rendering_model.json     canonical model data, extracted from Steve's spreadsheet
tools/extract_model.py        the extractor (xlsx -> JSON + a JS data module)
python/brisket_model/         tested Python port of the math (model + calculator, no chat/CLI)
python/tests/                 pytest suite, pinned to two of Steve's own worked examples
assets/                       the static web app (HTML/CSS/JS) -- see below
tests/                        Node test suite (unit tests + a full jsdom DOM integration test)
```

### The web app (GitHub Pages ready)

`index.html` at the repo root is a fully static site — no build step, no
bundler, nothing to compile. Two tabs:

1. **Ask Steve** — the whole point of this project. A chat interface backed
   by a genuine **open-source LLM running entirely in your browser** via
   [WebLLM](https://github.com/mlc-ai/web-llm) and WebGPU — no server, no
   API key, nothing ever leaves your machine. Pick from a few small instruct
   models (SmolLM2 360M up to Qwen2.5 1.5B).

   The chat is **gated behind a real loading status bar**: the input and
   send button stay disabled, with a progress bar and status text, until
   the model has finished downloading and initializing. There's no
   degraded/fallback chat mode to fall back on -- if your browser doesn't
   support WebGPU, the status bar tells you that plainly instead of pretending
   to work.

   Numeric questions (rendering rate at a temp, hours needed to hit a target
   percent, "I pulled at 195 and held at 150 for 14 hours, is it done?") are
   silently intercepted by a deterministic grounding layer
   (`assets/js/grounding.js`) that computes the exact answer with the same
   tested calculator engine as the Python port, and hands that computed fact
   to the LLM as context. The model only supplies conversational framing —
   it never does the arithmetic itself, so the numbers you see are
   deterministic, not guessed.

2. **About** — full credit and links back to the source.

There is deliberately **no calculator UI** here — Steve's own site already
has one (see the article link above). This project is just the chatbot.

### Deploying to GitHub Pages

Because everything lives at the repo root with a plain `index.html`, this is
zero-config:

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under "Build and deployment", set **Source: Deploy from a branch**, branch
   **main**, folder **/ (root)**.
4. Save. Your site will be live at `https://<user>.github.io/<repo>/`.

No GitHub Actions workflow required, since there's no build step.

## Running it locally

Static site — just serve the folder (opening `index.html` directly also
works, since the model data is embedded as a JS module rather than fetched):

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

### Python

The Python side is just the tested math library and the spreadsheet
extractor now (no CLI, no chatbot) — it exists so the model itself has an
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

This rewrites `data/rendering_model.json`, `assets/data/rendering_model.json`,
and `assets/js/data.generated.js` from the workbook's actual cells — nothing
is hand-typed, so the Python package and the web app can never silently
drift from the source.

### JavaScript

```bash
npm install
npm test     # unit tests for model.js + grounding.js, plus a jsdom integration test
```

## Why an in-browser open-source LLM instead of an API?

GitHub Pages only serves static files — there's no backend to hold an API
key safely. Running a small open-source model (Llama 3.2, Qwen2.5, SmolLM2,
etc.) client-side via WebGPU means the chat works on a purely static site,
for free, with nothing to configure and nothing to leak. The tradeoff is a
one-time model download (hundreds of MB to ~1.3GB depending on which one you
pick) and a WebGPU-capable browser (recent desktop Chrome/Edge) — that's
exactly what the loading status bar is gating against.

## Why keep a calculator engine if there's no calculator UI?

The chat still needs to answer numeric questions correctly, and small LLMs
are unreliable at arithmetic. So the tested calculator (ported to both
Python and JS from Steve's spreadsheet) stays in the codebase as a
**grounding engine**: before the LLM sees a numeric question, a deterministic
extractor computes the real answer and injects it as context, so the LLM's
reply states a computed number instead of a guessed one. It's invisible to
the user — there's only ever one chat experience — but it's why the answers
that matter are deterministic under the hood.

## Data provenance

Every rendering rate, texture band, confirmed method, and cooldown pattern
in `data/rendering_model.json` is transcribed from either Steve Gow's
published spreadsheet or his own comment replies on the article (quoted
verbatim where used, e.g. the exact zone-by-zone breakdown he gave a reader
named Jack, which doubles as one of this repo's regression tests). See
`tools/extract_model.py` for exactly where each field comes from.
