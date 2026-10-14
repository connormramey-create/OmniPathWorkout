import { buildStandardPlan, buildProgramSkeleton, setSlotExercise, copyFirstWeekToAll, markDayCompleted, effortTypeForPlanDay } from "../src/services/planBuilder.js";
import { cloudFingerprint, normalizePlan, copyPublicProgram, asArray } from "../src/services/dbService.js";
import { generateWorkoutSession, prepareActiveSession, summarizeExerciseLog, DEFAULT_SETTINGS } from "../src/services/workoutEngine.js";
let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log("FAIL:", m); } };

const sp = buildStandardPlan("upper_lower", 2);
check(sp.weeks.length === 8 && sp.weeks[0].days.length === 7, "standard plan shape");
const w1 = sp.weeks[0].days;
console.log("week1:", w1.map(d => `${d.title}/${effortTypeForPlanDay(sp, 1, d.id)}`).join(", "));
check(effortTypeForPlanDay(sp, 1, "w1_d1") === "max" && effortTypeForPlanDay(sp, 1, "w1_d4") === "dynamic" && effortTypeForPlanDay(sp, 1, "w1_d5") === "dynamic" && effortTypeForPlanDay(sp, 1, "w1_d2") === "max", "conjugate plan effort");
const sp2 = markDayCompleted(sp, "w1_d1"); check(sp2.weeks[0].days[0].completed && !sp.weeks[0].days[0].completed, "immutability");

let pb = buildProgramSkeleton({ title: "T", weeks: 4, workoutsPerWeek: 3, exercisesPerSession: 4, progressionRate: 2.5, restTime: 90 });
pb = setSlotExercise(pb, 1, 2, 1, { id: "ex_001", name: "Barbell Bench Press", equipment: "barbell", target: "pectorals" });
pb = copyFirstWeekToAll(pb);
check(pb.weeks[3].days[1].exercises[1]?.name === "Barbell Bench Press", "copy week 1");
// Simulate Firebase round-trip: nulls dropped, sparse arrays -> objects
const fbify = (v) => { if (v === null) return undefined; if (Array.isArray(v)) { const o = {}; v.forEach((x, i) => { const y = fbify(x); if (y !== undefined) o[i] = y; }); return Object.keys(o).length ? o : undefined; } if (typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) { const y = fbify(x); if (y !== undefined) o[k] = y; } return Object.keys(o).length ? o : undefined; } return v; };
const back = normalizePlan(fbify(pb));
check(back.weeks.length === 4 && back.weeks[0].days[1].exercises.length === 4 && back.weeks[0].days[1].exercises[0] === null && back.weeks[0].days[1].exercises[1].name === "Barbell Bench Press", "normalizePlan after firebase round trip");
check(cloudFingerprint(pb) === cloudFingerprint(fbify(pb)), "fingerprint stable across firebase round trip");
check(cloudFingerprint({ a: [], b: 1 }) === cloudFingerprint({ b: 1 }), "fingerprint drops empty arrays");
check(cloudFingerprint({ a: 1 }) !== cloudFingerprint({ a: 2 }), "fingerprint detects change");
const copy = copyPublicProgram({ ...fbify(pb), id: "p1", title: "Cool", authorName: "Bob", weeks: back.weeks, exercisesPerSession: 4 });
check(copy.title === "Cool (copy)" && copy.isPublic === false && copy.weeks[0].days[1].exercises[1].name === "Barbell Bench Press", "copy public program");
check(asArray({0: "a", 1: "b"}).length === 2, "asArray");

// program builder session + progression rate
const s = generateWorkoutSession({ ...DEFAULT_SETTINGS, profile: "program_builder" }, [], { fixedExercises: pb.weeks[2].days[1].exercises, weekNum: 3 });
const a = prepareActiveSession(s, { ...DEFAULT_SETTINGS, profile: "program_builder" }, {}, { progressionRate: 2.5 });
console.log("PB week3:", a.logs.map(l => `${l.name} ${l.sets[0].weight}x${l.sets[0].reps} (${l.note})`));
check(a.logs.length === 1 && a.logs[0].sets[0].weight === 135, "pb weight");
// summarize
const log = { sets: [{ weight: 100, reps: 8, plannedReps: 8, completed: true }, { weight: 100, reps: 8, plannedReps: 8, completed: true }, { weight: 100, reps: 6, plannedReps: 8, completed: true }] };
check(summarizeExerciseLog(log).hitTarget === false, "missed rep detection");
log.sets[2].reps = 9; check(summarizeExerciseLog(log).hitTarget === true, "hit target");
check(summarizeExerciseLog({ sets: [{ completed: false }] }) === null, "skipped exercise");
console.log(fails ? `${fails} FAILURES` : "ALL EXTRA CHECKS PASSED");
