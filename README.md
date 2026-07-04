# The Gow Method — Brisket Cook & Hold Tribute

An unofficial fan tribute to **Steve Gow**'s Brisket "Cook & Hold" Tenderness
Model, published on [Smoke Trails BBQ](https://smoketrailsbbq.com/).

> This project is not affiliated with or endorsed by Steve Gow or Smoke
> Trails BBQ. Every number in here is transcribed directly from his own
> published work — please go visit the real thing:

- **Website:** [smoketrailsbbq.com](https://smoketrailsbbq.com/)
- **Original article:** [Brisket Holding Masterclass (And Tenderness Model)](https://smoketrailsbbq.com/brisket-holding-masterclass-and-tenderness-model/)
- **Video:** ["The Science of Brisket Tenderness (And Perfect Hold Time)"](https://www.youtube.com/watch?v=lplpPCU5UNQ&t=1203s) on YouTube
- **YouTube channel:** [@SmokeTrailsBBQ](https://www.youtube.com/@SmokeTrailsBBQ)
- **Rubs & shop:** [Smoke Trails BBQ Brisket Rub](https://smoketrailsbbq.com/product/smoke-trails-bbq-brisket-rub/), [General Purpose Rub](https://smoketrailsbbq.com/product/smoke-trails-bbq-lets-gow-general-purpose-rub/)

## The idea, in one sentence

Collagen turns into gelatin at a rate that grows **exponentially** with
internal temperature, so the hold isn't just a rest — it's part of the cook.
Steve built a simple "% rendered per hour" table for each 10°F zone, validated
it against real brisket cooks, and published a spreadsheet calculator. This
repo is a from-scratch, tested port of that same model, plus an interactive
web app and a couple of chatbot flavors as a fun tribute.

## What's in here

```
data/rendering_model.json     canonical model data, extracted from Steve's spreadsheet
tools/extract_model.py        the extractor (xlsx -> JSON + a JS data module)
python/brisket_model/         tested Python port (model, calculator, chatbot)
python/cli.py                 a terminal "tribute" app (ASCII art + calculator + chat)
python/tests/                 pytest suite, pinned to two of Steve's own worked examples
assets/                       the static web app (HTML/CSS/JS) -- see below
tests/                        Node test suite for the JS port (unit + full DOM integration)
```

### The web app (GitHub Pages ready)

`index.html` at the repo root is a fully static site — no build step, no
bundler, nothing to compile. It has three tabs:

1. **Calculator** — enter every temp/hours zone your brisket spent time in
   (cook *and* hold), see live Percent Done, texture verdict, and a chart of
   cumulative tenderness over time. Toggle between Steve's exact "classic
   zones" lookup and a smoother log-linear interpolation between zones (his
   own suggestion for extra precision, see the article comments).
2. **Ask Steve** — a chatbot tribute, in two layers:
   - **Rule-based (default):** deterministic, offline, instant. It parses
     questions like *"I pulled at 195 and held at 150 for 14 hours, is it
     done?"* using the exact same calculator math — zero chance of
     hallucinating a number.
   - **AI Mode (optional):** a genuine **open-source LLM running entirely in
     your browser** via [WebLLM](https://github.com/mlc-ai/web-llm) and
     WebGPU — no server, no API key, no data ever leaves your machine. Pick
     from a few small instruct models (SmolLM2 360M up to Qwen2.5 1.5B). The
     model only handles free-form conversation/persona; the actual math
     always comes from the deterministic engine.
3. **About** — full credit and links back to the source.

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

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 python/cli.py                       # the terminal tribute app
python3 -m pytest python/tests/ -v          # run the test suite
```

### Regenerating the model data from a spreadsheet

If Steve ever publishes a new version of the calculator spreadsheet:

```bash
python3 tools/extract_model.py path/to/Holding-chart-with-Calculator.xlsx
```

This rewrites `data/rendering_model.json`, `assets/data/rendering_model.json`,
and `assets/js/data.generated.js` from the workbook's actual cells — nothing
is hand-typed, so the Python package, the CLI, and the web app can never
silently drift from the source.

### JavaScript

```bash
npm install
npm test     # unit tests for the JS port + a full jsdom integration test
```

## Why an in-browser open-source LLM instead of an API?

GitHub Pages only serves static files — there's no backend to hold an API
key safely. Running a small open-source model (Llama 3.2, Qwen2.5, SmolLM2,
etc.) client-side via WebGPU means the "AI Mode" chat works on a purely
static site, for free, with nothing to configure and nothing to leak. The
tradeoff is a one-time model download (hundreds of MB) and a WebGPU-capable
browser (recent desktop Chrome/Edge); everything else in the app works
without either.

## Data provenance

Every rendering rate, texture band, confirmed method, and cooldown pattern
in `data/rendering_model.json` is transcribed from either Steve Gow's
published spreadsheet or his own comment replies on the article (quoted
verbatim where used, e.g. the exact zone-by-zone breakdown he gave a reader
named Jack, which doubles as one of this repo's regression tests). See
`tools/extract_model.py` for exactly where each field comes from.
