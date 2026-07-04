// model.js -- JS port of python/brisket_model/model.py + calculator.py
//
// Faithful port of Steve Gow's Brisket "Cook & Hold" Tenderness Model.
// See assets/js/data.generated.js for the underlying numbers (generated
// straight from his spreadsheet) and the Python package for the tested
// reference implementation this mirrors.

import { RENDERING_MODEL } from "./data.generated.js";

export const MODEL = RENDERING_MODEL;

function ratePoints() {
  return [...MODEL.rendering_rates].sort((a, b) => a.temp_f - b.temp_f);
}

/**
 * % rendered per hour at a given internal temperature.
 * mode: "zone" (floors to the nearest defined table point, matching the
 * spreadsheet + Steve's own clarification) or "interpolated" (log-linear
 * smoothing between the two bracketing points).
 */
export function rateAtTemp(tempF, mode = "zone") {
  const points = ratePoints();
  const first = points[0];
  const last = points[points.length - 1];

  if (tempF <= first.temp_f) return first.percent_per_hour;
  if (tempF >= last.temp_f) return last.percent_per_hour;

  if (mode === "zone") {
    let floorPoint = first;
    for (const p of points) {
      if (p.temp_f <= tempF) floorPoint = p;
      else break;
    }
    return floorPoint.percent_per_hour;
  }

  if (mode === "interpolated") {
    for (let i = 0; i < points.length - 1; i++) {
      const lo = points[i];
      const hi = points[i + 1];
      if (lo.temp_f <= tempF && tempF <= hi.temp_f) {
        return logLinearInterp(tempF, lo, hi);
      }
    }
    return last.percent_per_hour; // unreachable
  }

  throw new Error(`Unknown mode: ${mode} (expected "zone" or "interpolated")`);
}

function logLinearInterp(tempF, lo, hi) {
  let loRate = lo.percent_per_hour;
  if (loRate <= 0) {
    if (tempF <= lo.temp_f) return lo.percent_per_hour;
    loRate = 1e-6;
  }
  const span = hi.temp_f - lo.temp_f;
  if (span === 0) return hi.percent_per_hour;
  const fraction = (tempF - lo.temp_f) / span;
  const logLo = Math.log(loRate);
  const logHi = Math.log(hi.percent_per_hour);
  return Math.exp(logLo + (logHi - logLo) * fraction);
}

/**
 * Replicates the spreadsheet's B33 nested-IF formula exactly:
 * =IF(B31<80,"Underdone",IF(B31<95,"Slightly Underdone",
 *   IF(B31<=110,"PERFECTLY TENDER",IF(B31<=120,"Slightly Over","Overdone"))))
 */
export function textureForPercent(percent) {
  if (percent < 80) return "Underdone";
  if (percent < 95) return "Slightly Underdone";
  if (percent <= 110) return "PERFECTLY TENDER";
  if (percent <= 120) return "Slightly Over";
  return "Overdone";
}

export function foodSafetyNote() {
  return MODEL.food_safety_note;
}

/** entries: [{temp_f, hours}, ...] (cook + hold zones combined) */
export function totalPercentDone(entries, mode = "zone") {
  return entries.reduce((sum, e) => sum + rateAtTemp(e.temp_f, mode) * e.hours, 0);
}

export function evaluate(entries, mode = "zone") {
  const total = totalPercentDone(entries, mode);
  const { min_percent, max_percent } = MODEL.target_range;
  return {
    totalPercent: total,
    remainingTo100: Math.max(0, 100 - total),
    texture: textureForPercent(total),
    inTargetRange: total >= min_percent && total <= max_percent,
  };
}

export function hoursNeededAtTemp(currentPercent, holdTempF, targetPercent = 100, mode = "zone") {
  const rate = rateAtTemp(holdTempF, mode);
  const remaining = targetPercent - currentPercent;
  if (remaining <= 0) return 0;
  if (rate <= 0) return Infinity;
  return remaining / rate;
}

export function projectTimeline(entries, mode = "zone") {
  let cumulativeHours = 0;
  let cumulativePercent = 0;
  return entries.map((e) => {
    const rate = rateAtTemp(e.temp_f, mode);
    cumulativeHours += e.hours;
    cumulativePercent += rate * e.hours;
    return {
      tempF: e.temp_f,
      hours: e.hours,
      cumulativeHours,
      ratePercentPerHour: rate,
      cumulativePercent,
      texture: textureForPercent(cumulativePercent),
    };
  });
}

export function confirmedMethods() {
  return MODEL.confirmed_methods;
}

export function standardCooldownPatterns() {
  return MODEL.standard_cooldown_patterns;
}

export function documentedCaseStudies() {
  return MODEL.documented_case_studies;
}

export function workedExample() {
  return MODEL.worked_example;
}

export function credit() {
  return MODEL._credit;
}
