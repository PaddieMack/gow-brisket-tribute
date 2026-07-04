// chatbot-rules.js -- JS port of python/brisket_model/chatbot.py
//
// Deterministic, offline "Ask Steve" responder. No model download, no
// hallucination risk for the actual numbers. See chatbot-llm.js for the
// optional in-browser open-source LLM ("AI Mode") that layers free-form
// conversation on top of this.

import {
  MODEL,
  rateAtTemp,
  textureForPercent,
  totalPercentDone,
  hoursNeededAtTemp,
  foodSafetyNote,
  confirmedMethods,
  standardCooldownPatterns,
  documentedCaseStudies,
  credit,
} from "./model.js";

const NUMBER = "(\\d+(?:\\.\\d+)?)";

export const FALLBACK_TEXT =
  "I'm a rule-based tribute bot for Steve Gow's brisket model -- try asking " +
  "things like: 'what's the rendering rate at 190?', 'I pulled at 195 and " +
  "held at 150 for 14 hours, is it done?', 'give me a confirmed method', " +
  "or 'what's the tenderness guide?'";

function fmtPct(x) {
  return `${x.toFixed(1).replace(/\.0$/, "")}%`;
}

function about() {
  const c = credit();
  return (
    `This is a fan tribute to "${c.method_name}" by ${c.author} of ${c.source}. ` +
    `All the math here is ported straight from his published spreadsheet. ` +
    `Full write-up: ${c.article_url}\n\n${c.note}`
  );
}

function textureGuide() {
  return (
    "Tenderness guide (Percent Done -> Texture):\n" +
    "  80-90%   Slightly tight but sliceable\n" +
    "  95-105%  Ideal tenderness\n" +
    "  110-120% Very soft, possibly slightly over\n" +
    "  120%+    Risk of mushy or over-rendered\n" +
    "Target range: 95-110% is the sweet spot."
  );
}

function confirmedMethodsText() {
  const lines = ["Steve's confirmed cook + hold methods:"];
  for (const m of confirmedMethods()) {
    lines.push(
      `  - ~${m.hours_on_smoker_plus_minus_2} hr smoker to ${m.pull_temp_f}F ` +
        `(${m.pull_texture}), rest before hold: ${m.rest_before_hold}, ` +
        `then hold at ${m.hold_temp_f}F for ${m.hold_time_hours} hr`
    );
  }
  return lines.join("\n");
}

function rateLookupResponse(temp) {
  const zoneRate = rateAtTemp(temp, "zone");
  const interpRate = rateAtTemp(temp, "interpolated");
  return (
    `At ${temp}F, collagen renders at about ${zoneRate}%/hr (zone model), ` +
    `or ~${interpRate.toFixed(1)}%/hr with smooth interpolation.`
  );
}

function pulledAndHoldResponse(pullTemp, holdTemp, holdHours) {
  const patterns = standardCooldownPatterns();
  let match = null;
  if (Math.abs(pullTemp - 195) < 2.5) match = patterns[0];

  if (!match) {
    return (
      `I don't have a documented cooldown curve for pulling at ${pullTemp}F ` +
      `specifically -- Steve only published the exact decline for a 195F ` +
      `pull into a holding oven. Try Advanced mode in the calculator and ` +
      `enter your own smoker log hours per zone for the most accurate answer.`
    );
  }

  const zoneHours = match.zone_hours;
  const declinedHours = zoneHours.reduce((s, z) => s + z.hours, 0);
  const remainingHoldHours = Math.max(0, (holdHours || 0) - declinedHours);
  const entries = [...zoneHours, { temp_f: holdTemp, hours: remainingHoldHours }];
  const total = totalPercentDone(entries, "zone");
  const texture = textureForPercent(total);
  return (
    `Using Steve's documented decline pattern (1hr@190, 1hr@180, 1hr@170, ` +
    `1hr@160, then stabilizing at ${holdTemp}F) for ${holdHours || 0} total ` +
    `hold hours: roughly ${fmtPct(total)} done -> ${texture}. (This ignores ` +
    `whatever % you'd already built up during the cook itself before the pull.)`
  );
}

export function answer(message) {
  const text = (message || "").trim().toLowerCase();
  if (!text) {
    return "Ask me something about brisket tenderness, rendering rates, or hold times!";
  }

  if (/\b(hi|hello|hey|howdy)\b/.test(text)) {
    return "Howdy! Ask me about rendering rates, hold times, or say 'confirmed method' for a tried-and-true cook plan.";
  }

  if (["who is steve", "who's steve", "about", "credit", "what is this"].some((k) => text.includes(k))) {
    return about();
  }

  if (text.includes("safe")) {
    return foodSafetyNote();
  }

  if (text.includes("confirmed") || text.includes("preset") || text.includes("just tell me what to do")) {
    return confirmedMethodsText();
  }

  if ((text.includes("tender") && (text.includes("scale") || text.includes("guide") || text.includes("mean"))) || text.includes("texture")) {
    return textureGuide();
  }

  // NOTE: filler between a keyword and the number it modifies uses \D
  // (non-digit), not '.' -- a greedy '.{0,N}' right before \d+ eats leading
  // digits too, backtracking only enough to leave a trailing digit for the
  // capture group (e.g. "at 190" wrongly captures just "0"). See the Python
  // version's tests for the regression this fixes.
  const pulledMatch = text.match(
    new RegExp(`pull(?:ed)?\\D{0,10}${NUMBER}.*?(?:hold(?:ing)?|held)\\D{0,10}${NUMBER}`)
  );
  if (pulledMatch) {
    const pullTemp = parseFloat(pulledMatch[1]);
    const holdTemp = parseFloat(pulledMatch[2]);
    const hoursMatch = text.match(new RegExp(`${NUMBER}\\s*(?:hr|hour)`));
    const holdHours = hoursMatch ? parseFloat(hoursMatch[1]) : null;
    return pulledAndHoldResponse(pullTemp, holdTemp, holdHours);
  }

  const hoursNeededMatch = text.match(
    new RegExp(`from\\D{0,5}${NUMBER}%?.*?(?:to|at)\\D{0,5}${NUMBER}%?.*?(?:at|hold(?:ing)?|held)\\D{0,10}${NUMBER}`)
  );
  if (hoursNeededMatch) {
    const current = parseFloat(hoursNeededMatch[1]);
    const target = parseFloat(hoursNeededMatch[2]);
    const holdTemp = parseFloat(hoursNeededMatch[3]);
    const hrs = hoursNeededAtTemp(current, holdTemp, target);
    if (hrs === Infinity) {
      return `At ${holdTemp}F collagen won't meaningfully render -- pick a higher hold temp.`;
    }
    return `About ${hrs.toFixed(1)} more hours at ${holdTemp}F to go from ${current}% to ${target}%.`;
  }

  const rateMatch = text.match(new RegExp(`(?:rate|how fast)\\D{0,30}${NUMBER}`));
  if (rateMatch) {
    return rateLookupResponse(parseFloat(rateMatch[1]));
  }

  if (text.includes("jack") || text.includes("case study")) {
    const [caseStudy] = documentedCaseStudies();
    return `${caseStudy.description} Total: ${caseStudy.expected_total_percent}% -> ${caseStudy.expected_texture}.`;
  }

  return FALLBACK_TEXT;
}