/**
 * progression.js — decides the sets, reps and weight for every exercise in a workout.
 *
 * Two kinds of exercises are treated differently:
 *
 *  1. MAIN LIFTS — barbell Bench / Squat / Deadlift / Overhead Press (and close variations).
 *     These follow the selected progression scheme using the 1RMs from Settings.
 *     Which exercises count as main lifts is controlled by MAIN_LIFT_RULES below.
 *
 *  2. EVERYTHING ELSE (accessories, dumbbells, machines, bodyweight).
 *     Percent-of-1RM math makes no sense for a lateral raise, so these use
 *     "double progression": stay at a weight until you hit the top of the rep
 *     range, then add 5 lbs. This uses the last weight/reps you logged.
 *
 * Calisthenics uses the rep targets from calisthenicsTrees.json.
 *
 * Every function here is pure (no React, no Firebase), so it can be tested on its own.
 */

export const DEFAULT_MAX_LIFTS = { benchPress: 185, squat: 225, deadlift: 275, overheadPress: 115 };

export const PROGRESSION_SCHEMES = {
  linear: "Linear Progression (Beginner)",
  five_three_one: "5/3/1 Wave (Intermediate)",
  juggernaut: "Juggernaut 4-Week Waves (Intermediate)",
  conjugate: "Conjugate Max/Dynamic Effort (Advanced)"
};

/**
 * Which 1RM drives an exercise, and how heavy the variation is relative to it.
 * Checked top to bottom; the first match wins. Only barbell / smith machine exercises qualify.
 * ratio 0.8 means "use 80% of that 1RM as this exercise's max".
 */
export const MAIN_LIFT_RULES = [
  { match: /incline .*bench press/, key: "benchPress", ratio: 0.8 },
  { match: /close-grip .*bench press/, key: "benchPress", ratio: 0.9 },
  { match: /(pause|pin) bench press/, key: "benchPress", ratio: 0.9 },
  { match: /bench press/, key: "benchPress", ratio: 1.0 },
  { match: /front squat/, key: "squat", ratio: 0.8 },
  { match: /(pause|pin) squat/, key: "squat", ratio: 0.85 },
  { match: /(back squat|box squat|safety bar squat|smith machine squat)/, key: "squat", ratio: 1.0 },
  { match: /(romanian|stiff-legged) deadlift/, key: "deadlift", ratio: 0.7 },
  { match: /(deficit|pause) deadlift/, key: "deadlift", ratio: 0.85 },
  { match: /(conventional|sumo|trap bar) deadlift/, key: "deadlift", ratio: 1.0 },
  { match: /(overhead barbell press|overhead press|military press)/, key: "overheadPress", ratio: 1.0 }
];

/** The exercise each main lift uses when the generator needs "the" main lift. */
export const CANONICAL_MAIN_LIFTS = {
  benchPress: "Barbell Bench Press",
  squat: "Barbell Back Squat",
  deadlift: "Barbell Conventional Deadlift",
  overheadPress: "Overhead Barbell Press"
};

const LOWER_BODY_LIFTS = ["squat", "deadlift"];
const BARBELL_EQUIPMENT = ["barbell", "smith machine"];

/** Returns { key, ratio } if the exercise is a main lift, otherwise null. */
export function getMainLift(exercise) {
  const equipment = (exercise?.equipment || "").toLowerCase();
  if (!BARBELL_EQUIPMENT.includes(equipment)) return null;
  const name = (exercise.name || "").toLowerCase();
  const rule = MAIN_LIFT_RULES.find((r) => r.match.test(name));
  return rule ? { key: rule.key, ratio: rule.ratio } : null;
}

export function roundToNearest5(weight, minimum = 0) {
  return Math.max(minimum, Math.round(weight / 5) * 5);
}

/** Week number (1, 2, 3…) since the user started their current cycle (Settings > Restart cycle). */
export function getCycleWeek(settings, now = Date.now()) {
  const start = Date.parse(settings?.cycleStartDate || "");
  if (Number.isNaN(start)) return 1;
  return Math.max(1, Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1);
}

// ---------------------------------------------------------------------------
// Scheme tables — edit the numbers here to tune a program.
// pct = fraction of the TRAINING MAX (90% of your 1RM) for 5/3/1 and Juggernaut.
// ---------------------------------------------------------------------------

const TRAINING_MAX_FACTOR = 0.9;

// Jim Wendler's 5/3/1: 3 work weeks + 1 deload. "+" on the last set = as many reps as possible.
const FIVE_THREE_ONE_WEEKS = [
  { name: "Week 1 (5s)", sets: [[0.65, 5], [0.75, 5], [0.85, 5, true]] },
  { name: "Week 2 (3s)", sets: [[0.70, 3], [0.80, 3], [0.90, 3, true]] },
  { name: "Week 3 (5/3/1)", sets: [[0.75, 5], [0.85, 3], [0.95, 1, true]] },
  { name: "Deload", sets: [[0.40, 5], [0.50, 5], [0.60, 5]] }
];

// Juggernaut (simplified): 4 waves (10s, 8s, 5s, 3s) × 4 phases = 16 weeks.
// Each wave: Accumulation (most sets), Intensification (heavier), Realization (AMRAP test), Deload.
const JUGGERNAUT_WAVES = [
  { reps: 10, accumulation: [0.60, 5], intensification: [0.675, 3], realization: 0.75 },
  { reps: 8, accumulation: [0.65, 5], intensification: [0.725, 3], realization: 0.80 },
  { reps: 5, accumulation: [0.70, 6], intensification: [0.775, 4], realization: 0.85 },
  { reps: 3, accumulation: [0.75, 7], intensification: [0.825, 5], realization: 0.90 }
];

// Conjugate (Westside-style). Percentages are of the true 1RM.
const CONJUGATE_MAX_EFFORT = [[0.70, 3], [0.80, 3], [0.85, 2], [0.90, 1, true]];
const CONJUGATE_DYNAMIC_WAVE = [0.50, 0.55, 0.60]; // 3-week wave, then repeats
const CONJUGATE_DYNAMIC_SETS = { upper: [9, 3], lower: [10, 2] }; // [sets, reps]

// Rep ranges for non-main-lift exercises (double progression).
const ACCESSORY_REP_RANGE = {
  standard: [8, 12],
  powerlifter: [6, 8],
  program_builder: [8, 12],
  calisthenics: [8, 15]
};
const ACCESSORY_SETS = 3;
const ACCESSORY_INCREMENT_LBS = 5;

// Linear progression for main lifts: start weight (% of 1RM) and how much to add after a successful session.
const LINEAR_START = { standard: { pct: 0.70, reps: 8 }, powerlifter: { pct: 0.75, reps: 5 } };
const LINEAR_INCREMENT_LBS = { upper: 5, lower: 10 };

// ---------------------------------------------------------------------------

function makeSets(list, workingMax, labelPrefix) {
  return list.map(([pct, reps, isAmrap]) => ({
    reps,
    weight: roundToNearest5(workingMax * pct, 45),
    isAmrap: !!isAmrap,
    label: `${labelPrefix} ${Math.round(pct * 100)}%${isAmrap ? " — AMRAP" : ""}`
  }));
}

function repeatSet(count, pct, reps, workingMax, label) {
  return makeSets(Array.from({ length: count }, () => [pct, reps]), workingMax, label);
}

function fiveThreeOne(oneRepMax, weekNum) {
  const week = FIVE_THREE_ONE_WEEKS[(weekNum - 1) % 4];
  const trainingMax = oneRepMax * TRAINING_MAX_FACTOR;
  return {
    sets: makeSets(week.sets, trainingMax, "5/3/1"),
    note: `5/3/1 ${week.name} — % of training max (${roundToNearest5(trainingMax)} lbs)`
  };
}

function juggernaut(oneRepMax, weekNum) {
  const cycleWeek = (weekNum - 1) % 16; // 0..15
  const wave = JUGGERNAUT_WAVES[Math.floor(cycleWeek / 4)];
  const phase = cycleWeek % 4;
  const trainingMax = oneRepMax * TRAINING_MAX_FACTOR;
  const waveName = `${wave.reps}s wave`;

  if (phase === 0) {
    const [pct, sets] = wave.accumulation;
    return { sets: repeatSet(sets, pct, wave.reps, trainingMax, "Accum."), note: `Juggernaut ${waveName}: Accumulation` };
  }
  if (phase === 1) {
    const [pct, sets] = wave.intensification;
    return { sets: repeatSet(sets, pct, wave.reps, trainingMax, "Intens."), note: `Juggernaut ${waveName}: Intensification` };
  }
  if (phase === 2) {
    const ramp = [[0.50, 5], [0.60, 3], [0.70, 1], [wave.realization, wave.reps, true]];
    return { sets: makeSets(ramp, trainingMax, "Real."), note: `Juggernaut ${waveName}: Realization — beat ${wave.reps} reps on the last set` };
  }
  return { sets: makeSets([[0.40, 5], [0.50, 5], [0.60, 5]], trainingMax, "Deload"), note: `Juggernaut ${waveName}: Deload` };
}

function conjugate(oneRepMax, weekNum, effortType, liftKey) {
  if (effortType === "dynamic") {
    const pct = CONJUGATE_DYNAMIC_WAVE[(weekNum - 1) % CONJUGATE_DYNAMIC_WAVE.length];
    const [sets, reps] = CONJUGATE_DYNAMIC_SETS[LOWER_BODY_LIFTS.includes(liftKey) ? "lower" : "upper"];
    return {
      sets: repeatSet(sets, pct, reps, oneRepMax, "Speed"),
      note: "Conjugate Dynamic Effort — move the bar as fast as possible, ~45-60 s rest"
    };
  }
  return {
    sets: makeSets(CONJUGATE_MAX_EFFORT, oneRepMax, "Max Effort"),
    note: "Conjugate Max Effort — work up to a heavy single (stop at RPE 9)"
  };
}

function linearMainLift(oneRepMax, profile, liftKey, lastRecord) {
  const start = LINEAR_START[profile] || LINEAR_START.standard;
  const increment = LINEAR_INCREMENT_LBS[LOWER_BODY_LIFTS.includes(liftKey) ? "lower" : "upper"];
  let weight = roundToNearest5(oneRepMax * start.pct, 45);
  let note = `Linear: starting at ${Math.round(start.pct * 100)}% of your 1RM`;

  if (lastRecord?.lastWeight > 0) {
    const hitTarget = lastRecord.hitTarget ?? lastRecord.lastReps >= start.reps;
    weight = hitTarget ? lastRecord.lastWeight + increment : lastRecord.lastWeight;
    note = hitTarget
      ? `Linear: you hit all reps last time → +${increment} lbs`
      : "Linear: missed reps last time → repeat the same weight";
  }
  const sets = Array.from({ length: 3 }, () => ({ reps: start.reps, weight, isAmrap: false, label: "Linear" }));
  return { sets, note };
}

function programBuilderMainLift(oneRepMax, weekNum, ratePct) {
  const growth = 1 + ((Number(ratePct) || 0) / 100) * (weekNum - 1);
  const weight = roundToNearest5(oneRepMax * 0.70 * growth, 45);
  const sets = Array.from({ length: 3 }, () => ({ reps: 8, weight, isAmrap: false, label: `Week ${weekNum}` }));
  return { sets, note: `Program Builder: 70% of 1RM + ${ratePct || 0}% per week` };
}

/** Double progression for anything that isn't a main lift. */
function accessory(exercise, profile, lastRecord) {
  const [low, high] = ACCESSORY_REP_RANGE[profile] || ACCESSORY_REP_RANGE.standard;
  const isBodyweight = (exercise.equipment || "").toLowerCase() === "body weight";
  let weight = isBodyweight ? 0 : ""; // "" = blank box until the user enters a weight
  let reps = low;
  let note;

  if (isBodyweight) {
    if (lastRecord?.lastReps >= high) {
      note = `Bodyweight: you hit ${high}+ reps → try a harder variation or add load`;
      reps = high;
    } else {
      reps = Math.min(high, Math.max(low, (lastRecord?.lastReps || low - 1) + 1));
      note = `Bodyweight: aim for ${reps} reps (goal ${high})`;
    }
  } else if (lastRecord?.lastWeight > 0) {
    if (lastRecord.lastReps >= high) {
      weight = lastRecord.lastWeight + ACCESSORY_INCREMENT_LBS;
      note = `You hit ${high} reps last time → +${ACCESSORY_INCREMENT_LBS} lbs`;
    } else {
      weight = lastRecord.lastWeight;
      reps = Math.min(high, Math.max(low, (lastRecord.lastReps || low) + 1));
      note = `Same weight, aim for ${reps} reps (add weight at ${high})`;
    }
  } else {
    note = `First time: pick a weight you can lift ${low}-${high} reps with ~2 reps left in the tank`;
  }

  const sets = Array.from({ length: ACCESSORY_SETS }, () => ({ reps, weight, isAmrap: false, label: `${low}-${high} reps` }));
  return { sets, note };
}

/** "8-12 reps" → 8, "20-30 sec hold" → 20 */
function parseLowerBound(text) {
  const match = String(text || "").match(/\d+/);
  return match ? parseInt(match[0], 10) : 8;
}

function calisthenicsSkill(treeStep) {
  const reps = parseLowerBound(treeStep.reps);
  const label = treeStep.isNextSkill ? "Next skill" : "Skill";
  const sets = Array.from({ length: 3 }, () => ({ reps, weight: 0, isAmrap: false, label }));
  const note = treeStep.isNextSkill
    ? `NEXT SKILL (${treeStep.treeLabel} Lvl ${treeStep.level}) — goal ${treeStep.reps}. Use negatives or assistance if needed.`
    : `${treeStep.treeLabel} Lvl ${treeStep.level} — goal ${treeStep.reps}`;
  return { sets, note };
}

/**
 * Main entry point.
 * @param {object} exercise  An exercise from exercises.json (may carry .treeStep for calisthenics)
 * @param {object} ctx
 *   scheme        "linear" | "five_three_one" | "juggernaut" | "conjugate"
 *   profile       "standard" | "powerlifter" | "calisthenics" | "program_builder"
 *   weekNum       1-based week of the cycle/plan
 *   effortType    "max" | "dynamic" (conjugate only)
 *   maxLifts      { benchPress, squat, deadlift, overheadPress }
 *   lastRecord    { lastWeight, lastReps, hitTarget } from exercise history, or undefined
 *   progressionRate  % per week (Program Builder only)
 * @returns {{ sets: Array<{reps, weight, label, isAmrap}>, note: string, isMainLift: boolean }}
 */
export function buildSetsForExercise(exercise, ctx) {
  const { scheme = "linear", profile = "standard", weekNum = 1, effortType = "max", lastRecord } = ctx;

  if (exercise.treeStep) return { ...calisthenicsSkill(exercise.treeStep), isMainLift: false };

  const mainLift = profile === "calisthenics" ? null : getMainLift(exercise);
  if (!mainLift) return { ...accessory(exercise, profile, lastRecord), isMainLift: false };

  const maxes = { ...DEFAULT_MAX_LIFTS, ...(ctx.maxLifts || {}) };
  const oneRepMax = (parseFloat(maxes[mainLift.key]) || DEFAULT_MAX_LIFTS[mainLift.key]) * mainLift.ratio;

  let result;
  if (profile === "program_builder") result = programBuilderMainLift(oneRepMax, weekNum, ctx.progressionRate);
  else if (scheme === "five_three_one") result = fiveThreeOne(oneRepMax, weekNum);
  else if (scheme === "juggernaut") result = juggernaut(oneRepMax, weekNum);
  else if (scheme === "conjugate") result = conjugate(oneRepMax, weekNum, effortType, mainLift.key);
  else result = linearMainLift(oneRepMax, profile, mainLift.key, lastRecord);

  return { ...result, isMainLift: true };
}
