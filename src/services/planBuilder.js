/**
 * planBuilder.js — creates and edits multi-week plans. Pure functions: they return a NEW plan
 * object and never modify the one passed in (React needs that to notice changes).
 *
 * Plan shape:
 *   { type: "standard_plan" | "program_builder", title?, weeks: [{ weekNum, days: [day] }], ... }
 *   standard day:        { id, dayNum, title, type: <split id or "rest">, completed }
 *   program builder day: { id, dayNum, title, exercises: [exercise | null], completed }
 */
import { getSplitDefinition } from "./workoutEngine";

const WEEK_TEMPLATES = {
  ppl: ["ppl_push", "ppl_pull", "ppl_legs", "rest", "ppl_push", "ppl_pull", "rest"],
  full_body: ["full_body", "rest", "full_body", "rest", "full_body", "rest", "rest"],
  upper_lower: ["upper", "lower", "rest", "upper", "lower", "rest", "rest"]
};

function weekTemplateFor(split) {
  if (split.startsWith("ppl")) return WEEK_TEMPLATES.ppl;
  if (split === "full_body") return WEEK_TEMPLATES.full_body;
  return WEEK_TEMPLATES.upper_lower;
}

export function buildStandardPlan(split, months) {
  const template = weekTemplateFor(split);
  const weeks = Array.from({ length: months * 4 }, (_, w) => ({
    weekNum: w + 1,
    days: template.map((type, d) => ({
      id: `w${w + 1}_d${d + 1}`,
      dayNum: d + 1,
      title: type === "rest" ? "Rest Day" : getSplitDefinition(type).title.replace(" SESSION", ""),
      type,
      completed: false
    }))
  }));
  return { type: "standard_plan", split, weeks };
}

export function buildProgramSkeleton({ title, weeks, workoutsPerWeek, exercisesPerSession, progressionRate, restTime }) {
  const slots = Math.min(15, Math.max(1, exercisesPerSession || 5));
  const days = Math.min(7, Math.max(1, workoutsPerWeek || 4));
  return {
    type: "program_builder",
    title: title || "My Custom Program",
    exercisesPerSession: slots,
    progressionRate,
    restTime,
    isPublic: false,
    publicId: null,
    weeks: Array.from({ length: weeks }, (_, w) => ({
      weekNum: w + 1,
      days: Array.from({ length: days }, (_, d) => ({
        id: `w${w + 1}_d${d + 1}`,
        dayNum: d + 1,
        title: `Day ${d + 1} Session`,
        exercises: Array(slots).fill(null),
        completed: false
      }))
    }))
  };
}

function mapDays(plan, fn) {
  return { ...plan, weeks: plan.weeks.map((w) => ({ ...w, days: w.days.map((d) => fn(d, w)) })) };
}

export function setSlotExercise(plan, weekNum, dayNum, slotIdx, exercise) {
  return mapDays(plan, (day, week) => {
    if (week.weekNum !== weekNum || day.dayNum !== dayNum) return day;
    const exercises = [...day.exercises];
    exercises[slotIdx] = exercise;
    return { ...day, exercises };
  });
}

/** Copies week 1's exercises into every other week (saves filling 16 weeks by hand). */
export function copyFirstWeekToAll(plan) {
  const first = plan.weeks[0];
  return mapDays(plan, (day, week) => {
    if (week.weekNum === first.weekNum) return day;
    const source = first.days.find((d) => d.dayNum === day.dayNum);
    return source ? { ...day, exercises: [...source.exercises] } : day;
  });
}

export function markDayCompleted(plan, dayId) {
  return mapDays(plan, (day) => (day.id === dayId ? { ...day, completed: true } : day));
}

/**
 * Conjugate effort type for a plan day: within a week, the first upper (or lower) day is
 * Max Effort and the next one is Dynamic Effort, alternating after that.
 */
export function effortTypeForPlanDay(plan, weekNum, dayId) {
  const week = plan.weeks.find((w) => w.weekNum === weekNum);
  if (!week) return "max";
  const day = week.days.find((d) => d.id === dayId);
  const region = getSplitDefinition(day?.type).region;
  const earlierSameRegion = week.days
    .slice(0, week.days.indexOf(day))
    .filter((d) => d.type !== "rest" && getSplitDefinition(d.type).region === region).length;
  return earlierSameRegion % 2 === 0 ? "max" : "dynamic";
}
