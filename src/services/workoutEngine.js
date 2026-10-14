/**
 * workoutEngine.js — builds a workout session.
 *
 * Pipeline (generateWorkoutSession):
 *   1. resolveSplit        upper_lower / ppl rotate based on your last logged workout
 *   2. buildExercisePool   injury filter → equipment filter → calisthenics skill-tree gate
 *   3. pickBalanced        one exercise per required muscle group, then fill extra slots
 *   4. warm-ups/cool-downs from warmups.json for every muscle group in the session
 *
 * Then prepareActiveSession() turns the session into sets/reps/weights via progression.js.
 *
 * Data lives in src/data/*.json so it can be edited without touching this file.
 */
import EXERCISES from "../data/exercises.json";
import INJURIES from "../data/injuries.json";
import MUSCLE_GROUPS from "../data/muscleGroups.json";
import WARMUPS from "../data/warmups.json";
import CALISTHENICS from "../data/calisthenicsTrees.json";
import { CANONICAL_MAIN_LIFTS, DEFAULT_MAX_LIFTS, buildSetsForExercise, getMainLift } from "./progression";

export { DEFAULT_MAX_LIFTS };
export const ALL_EXERCISES = EXERCISES;
export const INJURY_OPTIONS = Object.entries(INJURIES)
  .filter(([key]) => !key.startsWith("_"))
  .map(([key, value]) => ({ id: key, name: value.name }));
export const CALISTHENICS_TREES = CALISTHENICS.trees;
export const MUSCLE_GROUP_LABELS = Object.fromEntries(
  Object.entries(MUSCLE_GROUPS.groups).map(([key, g]) => [key, g.label])
);

export const ALL_EQUIPMENT = [
  "barbell", "dumbbell", "cable", "leverage machine", "smith machine", "body weight",
  "kettlebell", "band", "stability ball", "medicine ball", "other"
];

export const DEFAULT_SETTINGS = {
  profile: "standard",
  progressionScheme: "linear",
  cycleStartDate: new Date().toISOString(),
  split: "upper_lower",
  duration: 45,
  restTime: 60,
  equipment: ALL_EQUIPMENT,
  maxLifts: DEFAULT_MAX_LIFTS,
  selectedInjury: "none",
  autoStartTimer: true,
  backgroundTimerAlert: false,
  calisthenicsUnlocked: []
};

const DIFFICULTY_RANK = { beginner: 0, intermediate: 1, advanced: 2 };
const COMPOUND_PATTERNS = ["horizontal push", "vertical push", "horizontal pull", "vertical pull", "squat", "hinge"];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const lower = (value) => (value || "").toLowerCase().trim();

const TARGET_TO_GROUP = Object.entries(MUSCLE_GROUPS.groups).reduce((map, [groupKey, group]) => {
  group.targets.forEach((target) => { map[target] = groupKey; });
  return map;
}, {});

/** "pectorals" → "chest". Returns null if the target isn't listed in muscleGroups.json. */
export function getMuscleGroup(exercise) {
  return TARGET_TO_GROUP[lower(exercise.target)] || null;
}

function isCompound(exercise) {
  const pattern = lower(exercise.movement_pattern);
  return COMPOUND_PATTERNS.some((p) => pattern.includes(p));
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function isExerciseContraindicated(exercise, injuryKey) {
  const keywords = INJURIES[injuryKey || "none"]?.contraindications || [];
  if (keywords.length === 0) return false;
  const haystack = [exercise.name, exercise.movement_pattern, exercise.target].map(lower);
  return keywords.some((keyword) => haystack.some((text) => text.includes(keyword)));
}

/** Number of exercise slots for a session length. 30→4, 45→6, 60→8, 90→12. */
export function slotsForDuration(minutes) {
  return Math.max(3, Math.floor((parseInt(minutes, 10) || 45) / 7.5));
}

// ---------------------------------------------------------------------------
// Splits
// ---------------------------------------------------------------------------

/** Split ids that rotate (upper_lower, ppl) resolve to the next split after your last logged workout. */
export function resolveSplit(splitId, history = []) {
  const def = MUSCLE_GROUPS.splits[splitId];
  if (!def) return "full_body";
  if (!def.rotation) return splitId;
  const last = history.find((entry) => def.rotation.includes(entry.split));
  if (!last) return def.rotation[0];
  return def.rotation[(def.rotation.indexOf(last.split) + 1) % def.rotation.length];
}

export function getSplitDefinition(splitId) {
  return MUSCLE_GROUPS.splits[splitId] || MUSCLE_GROUPS.splits.full_body;
}

/** Conjugate alternates Max Effort and Dynamic Effort for each region (upper / lower). */
export function nextEffortType(region, history = []) {
  const last = history.find((entry) => entry.region === region && entry.effortType);
  return last?.effortType === "max" ? "dynamic" : "max";
}

// ---------------------------------------------------------------------------
// Calisthenics skill trees
// ---------------------------------------------------------------------------

/** Converts old saved skill names (e.g. "Pull-Up") to the names used in exercises.json. */
export function normalizeSkillNames(names = []) {
  const legacy = CALISTHENICS.legacyNames || {};
  return Array.from(new Set(names.map((name) => legacy[name] || name)));
}

/**
 * Works out which tree skills are allowed: every mastered skill + the step right after it.
 * With nothing mastered in a tree, level 1 is the "next" skill.
 * Also returns the hardest unlocked difficulty per tree, used to cap non-tree bodyweight exercises.
 */
export function getCalisthenicsAccess(masteredNames = [], exercises = EXERCISES) {
  const mastered = new Set(normalizeSkillNames(masteredNames));
  const difficultyByName = Object.fromEntries(exercises.map((e) => [e.name, e.difficulty || "beginner"]));
  const stepByName = new Map(); // every tree exercise → info, with .unlocked
  const difficultyCap = {};

  Object.entries(CALISTHENICS.trees).forEach(([treeKey, tree]) => {
    let capRank = 0;
    tree.steps.forEach((step, idx) => {
      const isMastered = mastered.has(step.exercise);
      const previousMastered = idx === 0 || mastered.has(tree.steps[idx - 1].exercise);
      const isNextSkill = !isMastered && previousMastered;
      const unlocked = isMastered || isNextSkill;
      if (unlocked) capRank = Math.max(capRank, DIFFICULTY_RANK[difficultyByName[step.exercise]] ?? 0);
      stepByName.set(step.exercise, {
        treeKey, treeLabel: tree.label, level: step.level, reps: step.reps, isMastered, isNextSkill, unlocked
      });
    });
    difficultyCap[treeKey] = capRank;
  });

  return { stepByName, difficultyCap };
}

function treeForPattern(pattern) {
  const p = lower(pattern);
  return Object.entries(CALISTHENICS.trees).find(([, tree]) => tree.patterns.includes(p))?.[0] || null;
}

// ---------------------------------------------------------------------------
// Exercise pool
// ---------------------------------------------------------------------------

/** All exercises the user is allowed to get today, before balancing. */
export function buildExercisePool(settings, customExercises = []) {
  let pool = [...EXERCISES, ...customExercises];

  if (settings.selectedInjury && settings.selectedInjury !== "none") {
    pool = pool.filter((ex) => !isExerciseContraindicated(ex, settings.selectedInjury));
  }

  if (settings.profile === "calisthenics") {
    const { stepByName, difficultyCap } = getCalisthenicsAccess(settings.calisthenicsUnlocked, pool);
    return pool
      .filter((ex) => lower(ex.equipment) === "body weight")
      .filter((ex) => {
        const step = stepByName.get(ex.name);
        if (step) return step.unlocked; // tree skills: only mastered + next
        const treeKey = treeForPattern(ex.movement_pattern);
        const cap = treeKey ? difficultyCap[treeKey] : 0;
        return (DIFFICULTY_RANK[ex.difficulty] ?? 0) <= cap; // everything else: no harder than your tree level
      })
      .map((ex) => (stepByName.has(ex.name) ? { ...ex, treeStep: stepByName.get(ex.name) } : ex));
  }

  const equipment = (settings.equipment || ALL_EQUIPMENT).map(lower);
  return pool.filter((ex) => equipment.includes(lower(ex.equipment)));
}

// ---------------------------------------------------------------------------
// Balanced selection
// ---------------------------------------------------------------------------

/** Lower number = picked first within a muscle group. */
function preferenceTier(exercise, profile) {
  if (exercise.treeStep?.isNextSkill) return 0;
  if (exercise.treeStep) return 1;
  if (profile === "powerlifter" && isCompound(exercise)) return 1;
  return 2;
}

// The first exercise picked for these groups must use one of these movement patterns
// (so an upper-body day opens its back work with a row/pull-up, not a T-raise or a hinge).
const FIRST_PICK_PATTERNS = {
  chest: ["horizontal push", "vertical push"],
  back: ["horizontal pull", "vertical pull"],
  shoulders: ["vertical push", "shoulder abduction"],
  quads: ["squat"],
  hamstrings: ["hinge"],
  glutes: ["hinge", "squat", "hip extension"]
};

/**
 * Does this exercise count for a muscle group?
 * Gym profiles: the exercise's main target must be in the group (so "biceps" means a real biceps exercise).
 * Calisthenics: a primary muscle is enough (chin-ups cover biceps), since there are few isolation moves.
 */
function coversGroup(exercise, group, profile) {
  if (getMuscleGroup(exercise) === group) return true;
  if (profile !== "calisthenics") return false;
  const targets = MUSCLE_GROUPS.groups[group]?.targets || [];
  return (exercise.muscle_groups?.primary || []).some((m) => m === group || targets.includes(lower(m)));
}

function pickFromGroup(pool, group, chosen, profile) {
  const usedNames = new Set(chosen.map((e) => e.name));
  const inGroup = chosen.filter((e) => getMuscleGroup(e) === group);
  const usedPatterns = new Set(inGroup.map((e) => lower(e.movement_pattern)));
  const candidates = pool.filter((ex) => coversGroup(ex, group, profile) && !usedNames.has(ex.name));
  if (candidates.length === 0) return null;

  // 1. Prefer a movement pattern not used yet in this group (e.g. not two bench presses).
  let options = candidates.filter((ex) => !usedPatterns.has(lower(ex.movement_pattern)));
  if (options.length === 0) options = candidates;
  // 2. The first exercise for a big muscle group should be a compound lift (rows before T-raises).
  if (inGroup.length === 0 && FIRST_PICK_PATTERNS[group]) {
    const compounds = options.filter((ex) => FIRST_PICK_PATTERNS[group].includes(lower(ex.movement_pattern)));
    if (compounds.length > 0) options = compounds;
  }
  // 3. Then preference tier (calisthenics next skill first, etc.).
  const bestTier = Math.min(...options.map((ex) => preferenceTier(ex, profile)));
  return randomItem(options.filter((ex) => preferenceTier(ex, profile) === bestTier));
}

function pickMainLifts(pool, splitDef, settings) {
  if (!["standard", "powerlifter"].includes(settings.profile)) return [];
  const keys = settings.profile === "powerlifter"
    ? (splitDef.mainLifts || []).slice(0, 2)
    : [randomItem(splitDef.mainLifts || [])].filter(Boolean);

  return keys.map((key) => {
    const variations = pool.filter((ex) => getMainLift(ex)?.key === key);
    if (variations.length === 0) return null;
    // Conjugate rotates variations every session; other schemes stick to the competition lift.
    if (settings.progressionScheme === "conjugate") return randomItem(variations);
    return variations.find((ex) => ex.name === CANONICAL_MAIN_LIFTS[key]) || randomItem(variations);
  }).filter(Boolean);
}

/**
 * Guarantees one exercise per required muscle group (when one exists in the pool),
 * then fills remaining slots following the split's "fill" order.
 */
export function pickBalanced(pool, splitDef, count, settings) {
  const chosen = pickMainLifts(pool, splitDef, settings);
  const profile = settings.profile;

  splitDef.required.forEach((group) => {
    if (chosen.some((ex) => coversGroup(ex, group, profile))) return;
    const pick = pickFromGroup(pool, group, chosen, profile);
    if (pick) chosen.push(pick);
  });

  const fillOrder = splitDef.fill?.length ? splitDef.fill : splitDef.required;
  let addedThisRound = true;
  while (chosen.length < count && addedThisRound) {
    addedThisRound = false;
    for (const group of fillOrder) {
      if (chosen.length >= count) break;
      const pick = pickFromGroup(pool, group, chosen, profile);
      if (pick) { chosen.push(pick); addedThisRound = true; }
    }
  }

  // Order: main lifts → calisthenics skills → compound movements → isolation.
  const orderScore = (ex) => (getMainLift(ex) && profile !== "calisthenics" ? 0 : ex.treeStep ? 1 : isCompound(ex) ? 2 : 3);
  return chosen
    .map((ex, idx) => ({ ex, idx }))
    .sort((a, b) => orderScore(a.ex) - orderScore(b.ex) || a.idx - b.idx)
    .map(({ ex }) => ex);
}

// ---------------------------------------------------------------------------
// Warm-ups & cool-downs
// ---------------------------------------------------------------------------

function uniqueByName(items) {
  const seen = new Set();
  return items.filter((item) => (seen.has(item.name) ? false : seen.add(item.name)));
}

export function buildWarmupsAndCooldowns(exercises, injuryKey) {
  const groups = Array.from(new Set(exercises.map(getMuscleGroup).filter(Boolean)));
  const prehab = INJURIES[injuryKey || "none"]?.prehab_drills || [];
  const warmups = uniqueByName([
    ...WARMUPS.general,
    ...prehab,
    ...groups.flatMap((g) => WARMUPS.dynamic[g] || [])
  ]);
  const cooldowns = uniqueByName(groups.flatMap((g) => WARMUPS.cooldown[g] || []));
  return { warmups, cooldowns };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @param settings         user settings
 * @param customExercises  user-created exercises
 * @param options.splitOverride  force a split (used by plans)
 * @param options.history        workout history, newest first (for split rotation / conjugate)
 * @param options.fixedExercises use these exercises instead of generating (Program Builder days)
 * @param options.weekNum, options.effortType  override cycle week / conjugate effort
 */
export function generateWorkoutSession(settings, customExercises = [], options = {}) {
  const { splitOverride = null, history = [], fixedExercises = null } = options;
  const splitId = resolveSplit(splitOverride || settings.split, history);
  const splitDef = getSplitDefinition(splitId);

  let exercises;
  let missingGroups = [];
  if (fixedExercises) {
    exercises = fixedExercises.filter(Boolean);
  } else {
    const pool = buildExercisePool(settings, customExercises);
    const count = Math.max(slotsForDuration(settings.duration), splitDef.required.length);
    exercises = pickBalanced(pool, splitDef, count, settings);
    missingGroups = splitDef.required
      .filter((group) => !exercises.some((ex) => coversGroup(ex, group, settings.profile)))
      .map((group) => MUSCLE_GROUP_LABELS[group] || group);
  }

  const { warmups, cooldowns } = buildWarmupsAndCooldowns(exercises, settings.selectedInjury);
  const profileName = (settings.profile || "standard").replace("_", " ").toUpperCase();

  return {
    title: fixedExercises ? "CUSTOM PROGRAM SESSION" : `${profileName} · ${splitDef.title}`,
    split: splitId,
    region: splitDef.region || "full",
    weekNum: options.weekNum,
    effortType: options.effortType || nextEffortType(splitDef.region || "full", history),
    exercises,
    warmups,
    cooldowns,
    missingGroups
  };
}

/**
 * Turns a generated session into an active workout with sets/reps/weights.
 * @param exerciseHistory  { [exerciseId]: { lastWeight, lastReps, hitTarget } }
 */
export function prepareActiveSession(session, settings, exerciseHistory = {}, extra = {}) {
  const scheme = settings.progressionScheme || "linear";
  const ctxBase = {
    scheme,
    profile: settings.profile || "standard",
    weekNum: session.weekNum || 1,
    effortType: session.effortType,
    maxLifts: settings.maxLifts,
    progressionRate: extra.progressionRate
  };

  const logs = session.exercises.map((ex) => {
    const key = ex.id || ex.name;
    const lastRecord = exerciseHistory[key];
    const { sets, note, isMainLift } = buildSetsForExercise(ex, { ...ctxBase, lastRecord });
    return {
      id: key,
      name: ex.name,
      group: MUSCLE_GROUP_LABELS[getMuscleGroup(ex)] || ex.target,
      note,
      isMainLift,
      lastRecord: lastRecord ? `${lastRecord.lastWeight} lbs × ${lastRecord.lastReps} reps` : null,
      sets: sets.map((s) => ({ ...s, plannedReps: s.reps, completed: false }))
    };
  });

  return { ...session, startTime: new Date().toISOString(), logs };
}

/** Summary saved to exercise history after a workout; drives next session's progression. */
export function summarizeExerciseLog(log) {
  const completed = log.sets.filter((s) => s.completed);
  if (completed.length === 0) return null;
  const top = completed.reduce((best, s) => ((s.weight || 0) >= (best.weight || 0) ? s : best), completed[0]);
  const hitTarget = completed.length === log.sets.length &&
    log.sets.every((s) => (s.reps || 0) >= (s.plannedReps ?? s.reps));
  return {
    lastWeight: top.weight || 0,
    lastReps: top.reps || 0,
    hitTarget,
    date: new Date().toISOString()
  };
}
