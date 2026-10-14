/**
 * dbService.js — everything that reads/writes data: browser localStorage and Firebase.
 *
 * Firebase Realtime Database layout:
 *   users/{uid}/settings, history, exercise_history, custom_exercises
 *   users/{uid}/plans/{style}              the user's active plan per workout style
 *   public_programs/{programId}            programs shared with the community (see database.rules.json)
 *
 * Note: Firebase drops null values and turns arrays with gaps into objects, so plans read
 * back from Firebase go through normalizePlan() before use.
 */
import { db } from "../config/firebase";

// ---------------------------------------------------------------------------
// localStorage
// ---------------------------------------------------------------------------

export const STORAGE_KEYS = {
  settings: "gymbro_settings",
  history: "gymbro_history",
  exerciseHistory: "gymbro_exercise_history",
  customExercises: "gymbro_custom_exercises",
  activeSession: "gymbro_active_session"
};

export function getPlanStorageKey(style = "standard") {
  return `gymbro_active_plan_${style}`;
}

export function loadLocal(key, fallbackValue) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallbackValue;
  } catch (error) {
    console.warn(`[storage] could not read "${key}", using default.`, error);
    return fallbackValue;
  }
}

export function saveLocal(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[storage] could not save "${key}".`, error);
  }
}

/**
 * A comparable "fingerprint" of a value as Firebase would store it: Firebase drops nulls and
 * empty arrays/objects and turns arrays with gaps into objects. Used to tell whether local data
 * really differs from the cloud copy, so sync never loops or re-uploads unchanged data.
 */
export function cloudFingerprint(value) {
  const normalize = (v) => {
    if (v === null || v === undefined || v === "") return undefined;
    if (Array.isArray(v) || typeof v === "object") {
      const entries = Object.entries(v)
        .map(([k, child]) => [k, normalize(child)])
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return entries.length ? Object.fromEntries(entries) : undefined;
    }
    return v;
  };
  return JSON.stringify(normalize(value) ?? null);
}

/** Firebase may return arrays as objects ({0: x, 1: y}); this always gives back an array. */
export function asArray(value) {
  if (Array.isArray(value)) return value.filter((v) => v !== null && v !== undefined);
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

/** Firebase rejects `undefined`; a JSON round-trip removes it. */
function clean(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const out = [];
    Object.entries(value).forEach(([k, v]) => { out[Number(k)] = v; });
    return out;
  }
  return [];
}

/** Restores arrays/null slots that Firebase drops, so the UI can always map over them. */
export function normalizePlan(plan) {
  if (!plan || !plan.weeks) return plan || null;
  const slots = plan.exercisesPerSession;
  return {
    ...plan,
    weeks: toArray(plan.weeks).filter(Boolean).map((week) => ({
      ...week,
      days: toArray(week.days).filter(Boolean).map((day) => {
        if (plan.type !== "program_builder") return day;
        const exercises = toArray(day.exercises);
        const length = Math.max(slots || 0, exercises.length);
        return { ...day, exercises: Array.from({ length }, (_, i) => exercises[i] || null) };
      })
    }))
  };
}

// ---------------------------------------------------------------------------
// Per-user cloud data
// ---------------------------------------------------------------------------

/** Listens for changes to the user's data. Returns an unsubscribe function. */
export function subscribeToUserData(uid, onData) {
  if (!db || !uid) return () => {};
  const ref = db.ref(`users/${uid}`);
  const handler = (snapshot) => onData(snapshot.val() || {});
  const onError = (err) => console.error("[firebase] user data read failed:", err);
  ref.on("value", handler, onError);
  return () => ref.off("value", handler);
}

/** Saves only the fields you pass, e.g. saveUserData(uid, { settings }). */
export function saveUserData(uid, fields) {
  if (!db || !uid) return Promise.resolve();
  const map = {
    settings: "settings",
    history: "history",
    exerciseHistory: "exercise_history",
    customExercises: "custom_exercises",
    plans: "plans"
  };
  const update = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (map[key] && value !== undefined) update[map[key]] = clean(value);
  });
  return db.ref(`users/${uid}`).update(update)
    .catch((err) => console.error("[firebase] save failed:", err));
}

// ---------------------------------------------------------------------------
// Public (community) programs
// ---------------------------------------------------------------------------

const PUBLIC_PATH = "public_programs";

/** Creates or updates the public copy of a Program Builder plan. Returns the public id. */
export async function publishProgram(user, plan, { title, authorName }) {
  if (!db || !user) throw new Error("You need to be logged in to share a program.");
  const ref = plan.publicId ? db.ref(`${PUBLIC_PATH}/${plan.publicId}`) : db.ref(PUBLIC_PATH).push();
  const now = Date.now();
  const payload = clean({
    title: (title || "Untitled Program").slice(0, 80),
    authorUid: user.uid,
    authorName: (authorName || "Anonymous lifter").slice(0, 40), // never the email address
    createdAt: plan.publishedAt || now,
    updatedAt: now,
    durationWeeks: plan.weeks.length,
    workoutsPerWeek: plan.weeks[0]?.days.length || 0,
    exercisesPerSession: plan.exercisesPerSession,
    progressionRate: plan.progressionRate,
    restTime: plan.restTime,
    weeks: plan.weeks.map((w) => ({
      weekNum: w.weekNum,
      days: w.days.map((d) => ({
        id: d.id, dayNum: d.dayNum, title: d.title,
        exercises: d.exercises.map((ex) => (ex ? {
          id: ex.id, name: ex.name, target: ex.target, equipment: ex.equipment,
          movement_pattern: ex.movement_pattern, difficulty: ex.difficulty || null
        } : null))
      }))
    }))
  });
  await ref.set(payload);
  return { publicId: ref.key, publishedAt: payload.createdAt };
}

export function unpublishProgram(publicId) {
  if (!db || !publicId) return Promise.resolve();
  return db.ref(`${PUBLIC_PATH}/${publicId}`).remove();
}

/** Newest public programs first. Requires a logged-in user (see database.rules.json). */
export async function fetchPublicPrograms(limit = 50) {
  if (!db) return [];
  const snapshot = await db.ref(PUBLIC_PATH).orderByChild("createdAt").limitToLast(limit).once("value");
  const programs = [];
  snapshot.forEach((child) => { programs.push({ id: child.key, ...normalizePlan({ ...child.val(), type: "program_builder" }) }); });
  return programs.reverse();
}

/** Turns a public program into a fresh private Program Builder plan for the current user. */
export function copyPublicProgram(program) {
  return normalizePlan({
    type: "program_builder",
    title: `${program.title} (copy)`,
    copiedFrom: { id: program.id, authorName: program.authorName },
    isPublic: false,
    exercisesPerSession: program.exercisesPerSession,
    progressionRate: program.progressionRate,
    restTime: program.restTime,
    weeks: program.weeks.map((w) => ({
      weekNum: w.weekNum,
      days: w.days.map((d) => ({ ...d, completed: false }))
    }))
  });
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export function exportHistoryToCSV(workoutHistory = []) {
  if (!workoutHistory || workoutHistory.length === 0) {
    alert("No logged workout history available to export.");
    return;
  }

  const q = (text) => `"${String(text ?? "").replace(/"/g, '""')}"`;
  let csvContent = "Date,Workout Title,Exercise Name,Set Number,Weight (lbs),Reps Completed\n";

  workoutHistory.forEach((row) => {
    const date = row.date || "";
    if (row.logs && row.logs.length > 0) {
      row.logs.forEach((log) => {
        const completed = (log.sets || []).map((set, idx) => ({ set, idx })).filter(({ set }) => set.completed);
        if (completed.length === 0) {
          csvContent += `${q(date)},${q(row.title)},${q(`${log.name} (No Sets Logged)`)},-,-,-\n`;
        }
        completed.forEach(({ set, idx }) => {
          csvContent += `${q(date)},${q(row.title)},${q(log.name)},${idx + 1},${set.weight || 0},${set.reps || 0}\n`;
        });
      });
    } else {
      csvContent += `${q(date)},${q(row.title)},"Summary Only",-,${row.totalVolume || 0},0\n`;
    }
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `omnipath_progress_log_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // revoking immediately can cancel the download in some browsers
}
