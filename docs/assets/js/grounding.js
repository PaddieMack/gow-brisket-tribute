// grounding.js -- deterministic fact-extraction for the LLM chat.
//
// This is NOT a separate chat mode. It quietly looks at the user's message
// for a handful of well-defined, computable questions (a rate lookup, a
// "pulled at X held at Y for Z hours" cook, an hours-needed question) and,
// if it recognizes one, computes the exact answer with the same tested
// calculator engine as the Python port (model.js). That computed fact gets
// handed to the LLM as grounding context so its reply states a real
// computed number instead of guessing at arithmetic -- the LLM only
// handles the conversational framing, never the math itself.
//
// Returns null when nothing recognizable is found, in which case the LLM
// answers free-form (and its system prompt tells it to hedge accordingly).

import {
  rateAtTemp,
  textureForPercent,
  totalPercentDone,
  hoursNeededAtTemp,
  standardCooldownPatterns,
  confirmedMethods,
  documentedCaseStudies,
  MODEL,
} from "./model.js";

const NUMBER = "(\\d+(?:\\.\\d+)?)";

function fmtPct(x) {
  return `${x.toFixed(1).replace(/\.0$/, "")}%`;
}

function pulledAndHoldFact(pullTemp, holdTemp, holdHours) {
  const [pattern195] = standardCooldownPatterns();
  if (Math.abs(pullTemp - 195) >= 2.5) {
    return (
      `No documented cooldown curve exists for a ${pullTemp}F pull specifically -- Steve only ` +
      `published the exact decline for a 195F pull into a holding oven. Say so plainly; don't invent numbers.`
    );
  }
  const zoneHours = pattern195.zone_hours;
  const declinedHours = zoneHours.reduce((s, z) => s + z.hours, 0);
  const remainingHoldHours = Math.max(0, (holdHours || 0) - declinedHours);
  const entries = [...zoneHours, { temp_f: holdTemp, hours: remainingHoldHours }];
  const total = totalPercentDone(entries, "zone");
  const texture = textureForPercent(total);
  return (
    `Using Steve's documented decline pattern (1hr@190, 1hr@180, 1hr@170, 1hr@160, then stabilizing ` +
    `at ${holdTemp}F) for ${holdHours || 0} total hold hours after a ${pullTemp}F pull: exactly ` +
    `${fmtPct(total)} done -> ${texture}. This ignores whatever percent was already built up during ` +
    `the cook itself before the pull, since that's not knowable from the pull temp alone.`
  );
}

export function extractGroundedFact(message) {
  const text = (message || "").trim().toLowerCase();
  if (!text) return null;

  const pulledMatch = text.match(
    new RegExp(`pull(?:ed)?\\D{0,10}${NUMBER}.*?(?:hold(?:ing)?|held)\\D{0,10}${NUMBER}`)
  );
  if (pulledMatch) {
    const pullTemp = parseFloat(pulledMatch[1]);
    const holdTemp = parseFloat(pulledMatch[2]);
    const hoursMatch = text.match(new RegExp(`${NUMBER}\\s*(?:hr|hour)`));
    const holdHours = hoursMatch ? parseFloat(hoursMatch[1]) : null;
    return `COMPUTED FACT: ${pulledAndHoldFact(pullTemp, holdTemp, holdHours)}`;
  }

  const hoursNeededMatch = text.match(
    new RegExp(`from\\D{0,5}${NUMBER}%?.*?(?:to|at)\\D{0,5}${NUMBER}%?.*?(?:at|hold(?:ing)?|held)\\D{0,10}${NUMBER}`)
  );
  if (hoursNeededMatch) {
    const current = parseFloat(hoursNeededMatch[1]);
    const target = parseFloat(hoursNeededMatch[2]);
    const holdTemp = parseFloat(hoursNeededMatch[3]);
    const hrs = hoursNeededAtTemp(current, holdTemp, target);
    const fact =
      hrs === Infinity
        ? `At ${holdTemp}F collagen won't meaningfully render -- no amount of time gets you there.`
        : `Going from ${current}% to ${target}% while holding at ${holdTemp}F takes exactly ${hrs.toFixed(1)} more hours (rate: ${rateAtTemp(holdTemp, "zone")}%/hr).`;
    return `COMPUTED FACT: ${fact}`;
  }

  const rateMatch = text.match(new RegExp(`(?:rate|how fast)\\D{0,30}${NUMBER}`));
  if (rateMatch) {
    const temp = parseFloat(rateMatch[1]);
    const zoneRate = rateAtTemp(temp, "zone");
    const interpRate = rateAtTemp(temp, "interpolated");
    return (
      `COMPUTED FACT: At ${temp}F, collagen renders at exactly ${zoneRate}%/hr (Steve's zone table), ` +
      `or ~${interpRate.toFixed(1)}%/hr with smooth interpolation between zones.`
    );
  }

  if (text.includes("confirmed") || text.includes("preset") || text.includes("just tell me what to do")) {
    const lines = confirmedMethods().map(
      (m) =>
        `~${m.hours_on_smoker_plus_minus_2}hr smoker -> ${m.pull_temp_f}F (${m.pull_texture}), hold ${m.hold_temp_f}F x ${m.hold_time_hours}hr`
    );
    return `COMPUTED FACT: Steve's confirmed methods -- ${lines.join("; ")}.`;
  }

  if (text.includes("jack") || text.includes("case study")) {
    const [caseStudy] = documentedCaseStudies();
    return `COMPUTED FACT: ${caseStudy.description} Total: ${caseStudy.expected_total_percent}% -> ${caseStudy.expected_texture}.`;
  }

  if (text.includes("safe")) {
    return `COMPUTED FACT: ${MODEL.food_safety_note}`;
  }

  return null;
}
