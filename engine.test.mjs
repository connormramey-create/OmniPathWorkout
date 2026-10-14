import { generateWorkoutSession, prepareActiveSession, DEFAULT_SETTINGS, getMuscleGroup, buildExercisePool, getCalisthenicsAccess, resolveSplit } from "../src/services/workoutEngine.js";
import { buildSetsForExercise, getMainLift } from "../src/services/progression.js";
import MG from "../src/data/muscleGroups.json";
import EX from "../src/data/exercises.json";
import TREES from "../src/data/calisthenicsTrees.json";

let fails = 0;
const check = (cond, msg) => { if (!cond) { fails++; console.log("FAIL:", msg); } };

// 0. data integrity
const names = new Set(EX.map(e => e.name));
Object.values(TREES.trees).forEach(t => t.steps.forEach(s => check(names.has(s.exercise), "tree exercise missing: " + s.exercise)));
const unmapped = [...new Set(EX.filter(e => !getMuscleGroup(e)).map(e => e.target))];
console.log("targets not mapped to a group:", unmapped);

// 1. balance across splits/profiles/durations
const splits = ["upper", "lower", "ppl_push", "ppl_pull", "ppl_legs", "full_body"];
for (const profile of ["standard", "powerlifter"]) for (const split of splits) for (const duration of [30, 45, 60, 90]) {
  for (let i = 0; i < 200; i++) {
    const s = generateWorkoutSession({ ...DEFAULT_SETTINGS, profile, split, duration }, []);
    const groups = new Set(s.exercises.map(getMuscleGroup));
    for (const g of MG.splits[split].required) check(groups.has(g), `${profile}/${split}/${duration} missing ${g}`);
    check(new Set(s.exercises.map(e => e.name)).size === s.exercises.length, "duplicate exercise");
    for (const e of s.exercises) if (!getMainLift(e)) check(MG.splits[split].required.concat(MG.splits[split].fill).includes(getMuscleGroup(e)), `${split} has off-split ${e.name} (${e.target})`);
    if (fails > 20) break;
  }
}
const sample = generateWorkoutSession({ ...DEFAULT_SETTINGS, split: "upper", duration: 45 });
console.log("UPPER sample:", sample.exercises.map(e => `${e.name} [${getMuscleGroup(e)}]`));
console.log("warmups:", sample.warmups.map(w => w.name)); console.log("cooldowns:", sample.cooldowns.map(w => w.name));

// 2. rotation
check(resolveSplit("upper_lower", []) === "upper", "rotation start");
check(resolveSplit("upper_lower", [{ split: "upper" }]) === "lower", "rotation upper->lower");
check(resolveSplit("ppl", [{ split: "ppl_legs" }]) === "ppl_push", "ppl wrap");

// 3. calisthenics gating
const allTree = Object.values(TREES.trees).flatMap(t => t.steps.map(s => s.exercise));
const cases = [[], ["Push-Up"], ["Push-Up", "Diamond Push-Up", "Inverted Row"], ["Pull-Up", "Chin-Up"]];
for (const mastered of cases) {
  const pool = buildExercisePool({ ...DEFAULT_SETTINGS, profile: "calisthenics", calisthenicsUnlocked: mastered });
  const { stepByName } = getCalisthenicsAccess(mastered);
  const allowedTree = allTree.filter(n => stepByName.get(n).unlocked);
  const poolTree = pool.filter(e => allTree.includes(e.name)).map(e => e.name);
  check(JSON.stringify(poolTree.sort()) === JSON.stringify(allowedTree.sort()), "tree pool mismatch " + mastered);
  console.log("mastered", JSON.stringify(mastered), "-> tree allowed:", allowedTree.join(", "), "| pool size", pool.length, "| advanced non-tree:", pool.filter(e=>!e.treeStep && e.difficulty==="advanced").map(e=>e.name).join(", "));
  for (let i = 0; i < 100; i++) {
    for (const split of splits) {
      const s = generateWorkoutSession({ ...DEFAULT_SETTINGS, profile: "calisthenics", split, calisthenicsUnlocked: mastered });
      for (const e of s.exercises) if (allTree.includes(e.name)) check(stepByName.get(e.name).unlocked, "locked skill appeared " + e.name);
    }
  }
}
const cal = generateWorkoutSession({ ...DEFAULT_SETTINGS, profile: "calisthenics", split: "upper", calisthenicsUnlocked: ["Push-Up"] });
console.log("CAL upper (mastered Push-Up):", cal.exercises.map(e => e.name + (e.treeStep ? (e.treeStep.isNextSkill ? "*NEXT" : "*skill") : "")), "missing:", cal.missingGroups);
for (const split of splits) { const c = generateWorkoutSession({ ...DEFAULT_SETTINGS, profile: "calisthenics", split, calisthenicsUnlocked: [] }); console.log(" cal beginner", split, "missing:", c.missingGroups.join(",")||"-"); }

// 4. progression
const bench = EX.find(e => e.name === "Barbell Bench Press"), squat = EX.find(e => e.name === "Barbell Back Squat"), curl = EX.find(e => e.name.includes("Dumbbell") && e.target === "biceps");
const show = (ex, ctx) => { const r = buildSetsForExercise(ex, ctx); return `${r.note} :: ` + r.sets.map(s => `${s.weight}x${s.reps}${s.isAmrap ? "+" : ""}`).join(" "); };
const maxLifts = { benchPress: 200, squat: 300, deadlift: 400, overheadPress: 135 };
for (let w = 1; w <= 4; w++) console.log("531 bench w" + w, show(bench, { scheme: "five_three_one", weekNum: w, maxLifts }));
for (const w of [1, 2, 3, 4, 5, 15]) console.log("jugg squat w" + w, show(squat, { scheme: "juggernaut", weekNum: w, maxLifts }));
console.log("conj ME", show(squat, { scheme: "conjugate", weekNum: 1, effortType: "max", maxLifts }));
for (const w of [1,2,3,4]) console.log("conj DE w"+w, show(bench, { scheme: "conjugate", weekNum: w, effortType: "dynamic", maxLifts }));
console.log("linear first", show(squat, { scheme: "linear", maxLifts }));
console.log("linear hit", show(squat, { scheme: "linear", maxLifts, lastRecord: { lastWeight: 225, lastReps: 8, hitTarget: true } }));
console.log("linear miss", show(squat, { scheme: "linear", maxLifts, lastRecord: { lastWeight: 225, lastReps: 6, hitTarget: false } }));
console.log("PL linear", show(bench, { scheme: "linear", profile: "powerlifter", maxLifts }));
console.log("PB w1/w4", show(bench, { profile: "program_builder", weekNum: 1, progressionRate: 2.5, maxLifts }), "|", show(bench, { profile: "program_builder", weekNum: 4, progressionRate: 2.5, maxLifts }));
console.log("curl new", show(curl, { scheme: "five_three_one", maxLifts }));
console.log("curl hit top", show(curl, { maxLifts, lastRecord: { lastWeight: 30, lastReps: 12 } }));
console.log("curl mid", show(curl, { maxLifts, lastRecord: { lastWeight: 30, lastReps: 9 } }));

// 5. prepareActiveSession
const act = prepareActiveSession(sample, { ...DEFAULT_SETTINGS, progressionScheme: "five_three_one" }, {});
console.log("active logs:", act.logs.map(l => `${l.name}: ${l.sets.length} sets ${l.isMainLift ? "(MAIN)" : ""}`));
console.log(fails ? `\n${fails} FAILURES` : "\nALL CHECKS PASSED");
