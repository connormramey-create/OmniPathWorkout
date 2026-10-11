export const DEFAULT_MAX_LIFTS = {
  benchPress: 185,
  squat: 225,
  deadlift: 275,
  overheadPress: 115
};

export const UPPER_BODY_TARGETS = ["chest", "upper chest", "lower chest", "pectorals", "lats", "upper back", "shoulders", "front delts", "side delts", "rear delts", "traps", "biceps", "brachialis", "triceps", "forearms"];
export const LOWER_BODY_TARGETS = ["quads", "hamstrings", "glutes", "glute medius", "calves", "soleus", "gastrocnemius", "adductors", "shin", "tibialis anterior", "abs", "obliques", "core", "lower back"];
export const POWERLIFTER_COMPOUNDS = ["squat", "bench press", "deadlift", "overhead press", "barbell shoulder press", "sumo deadlift", "front squat", "incline bench press"];

export const ANTAGONIST_MAP = {
  "chest": ["lats", "upper back", "rhomboids"],
  "upper chest": ["lats", "upper back"],
  "lower chest": ["lats", "upper back"],
  "pectorals": ["lats", "upper back"],
  "lats": ["chest", "pectorals", "shoulders"],
  "upper back": ["chest", "pectorals"],
  "biceps": ["triceps"],
  "brachialis": ["triceps"],
  "triceps": ["biceps", "brachialis"],
  "quads": ["hamstrings", "glutes"],
  "hamstrings": ["quads"],
  "shoulders": ["lats", "rear delts"],
  "front delts": ["rear delts", "lats"],
  "side delts": ["traps", "lats"],
  "abs": ["lower back"],
  "obliques": ["lower back"],
  "lower back": ["abs", "obliques"]
};

export const MOVEMENT_PATTERNS = {
  HORIZONTAL_PUSH: ['horizontal push'],
  HORIZONTAL_PULL: ['horizontal pull'],
  VERTICAL_PUSH: ['vertical push'],
  VERTICAL_PULL: ['vertical pull'],
  KNEE_DOMINANT: ['squat', 'knee extension'],
  HIP_DOMINANT: ['hinge', 'hip extension', 'knee flexion']
};

export const CALISTHENICS_SKILL_TREES = {
  push: [
    { level: 1, name: "Push-Up", reps: "8-12 reps" },
    { level: 2, name: "Diamond Push-Up", reps: "8-12 reps" },
    { level: 3, name: "Pike Push-Up", reps: "6-10 reps" },
    { level: 4, name: "Elevated Pike Push-Up", reps: "5-8 reps" },
    { level: 5, name: "Handstand Push-Up (Wall Supported)", reps: "3-5 reps" }
  ],
  pull: [
    { level: 1, name: "Australian Inverted Row", reps: "8-12 reps" },
    { level: 2, name: "Chin-Up", reps: "6-10 reps" },
    { level: 3, name: "Pull-Up", reps: "5-8 reps" },
    { level: 4, name: "Archer Pull-Up", reps: "4-6 reps" },
    { level: 5, name: "Muscle-Up", reps: "2-4 reps" }
  ],
  legs: [
    { level: 1, name: "Air Squat", reps: "15-20 reps" },
    { level: 2, name: "Bulgarian Split Squat", reps: "8-12 reps" },
    { level: 3, name: "Shrimp Squat", reps: "5-8 reps" },
    { level: 4, name: "Pistol Squat", reps: "3-6 reps" }
  ]
};

export function isExerciseContraindicated(ex, injuryId, injuryDataset = {}) {
  const activeInj = injuryDataset[injuryId];
  if (!activeInj || !activeInj.contraindications || activeInj.contraindications.length === 0) {
    return false;
  }
  const name = (ex.name || '').toLowerCase();
  const pattern = (ex.movement_pattern || '').toLowerCase();
  const target = (ex.target || '').toLowerCase();

  return activeInj.contraindications.some(c => 
    name.includes(c.toLowerCase()) || pattern.includes(c.toLowerCase()) || target.includes(c.toLowerCase())
  );
}

export function roundTo5(weight) {
  return Math.max(10, Math.round(weight / 5) * 5);
}

export function getExerciseMaxLift(exercise, maxLifts = DEFAULT_MAX_LIFTS) {
  const name = (exercise.name || '').toLowerCase();
  const target = (exercise.target || '').toLowerCase();

  if (name.includes('bench') || name.includes('chest press') || target.includes('chest')) {
    return parseFloat(maxLifts.benchPress) || 185;
  }
  if (name.includes('squat') || name.includes('leg press') || target.includes('quad')) {
    return parseFloat(maxLifts.squat) || 225;
  }
  if (name.includes('deadlift') || name.includes('rdl') || name.includes('hip thrust') || target.includes('hamstring')) {
    return parseFloat(maxLifts.deadlift) || 275;
  }
  if (name.includes('press') || name.includes('shoulder') || target.includes('shoulder')) {
    return parseFloat(maxLifts.overheadPress) || 115;
  }
  return 135;
}

export function calculateProgressionSetTargets(exercise, scheme, weekNum, setIdx, userSettings = {}) {
  const style = userSettings.workoutStyle || "standard";

  if (style === "calisthenics") {
    return { reps: 10, weight: 0, label: "Natural Bodyweight Flow", isBodyweight: true };
  }

  const maxLift = getExerciseMaxLift(exercise, userSettings.maxLifts);
  let pct = 0.70;
  let reps = 10;
  let label = "";

  switch (scheme) {
    case "five_three_one": {
      const weekInCycle = ((weekNum - 1) % 4) + 1;
      if (weekInCycle === 1) {
        pct = [0.65, 0.75, 0.85][Math.min(setIdx, 2)];
        reps = 5;
        label = `5/3/1 W1 (${Math.round(pct * 100)}%)`;
      } else if (weekInCycle === 2) {
        pct = [0.70, 0.80, 0.90][Math.min(setIdx, 2)];
        reps = 3;
        label = `5/3/1 W2 (${Math.round(pct * 100)}%)`;
      } else if (weekInCycle === 3) {
        pct = [0.75, 0.85, 0.95][Math.min(setIdx, 2)];
        reps = [5, 3, 1][Math.min(setIdx, 2)];
        label = `5/3/1 W3 (${Math.round(pct * 100)}%)`;
      } else {
        pct = 0.50; reps = 5; label = `5/3/1 Deload (50%)`;
      }
      break;
    }
    case "juggernaut": {
      const wave = Math.ceil((weekNum % 16) / 4) || 1;
      if (weekNum % 4 === 0) { pct = 0.60; reps = 5; label = "Juggernaut Deload (60%)"; }
      else if (wave === 1) { pct = 0.70; reps = 10; label = "Juggernaut 10s (70%)"; }
      else if (wave === 2) { pct = 0.75; reps = 8; label = "Juggernaut 8s (75%)"; }
      else if (wave === 3) { pct = 0.80; reps = 5; label = "Juggernaut 5s (80%)"; }
      else { pct = 0.85; reps = 3; label = "Juggernaut 3s (85%)"; }
      break;
    }
    case "conjugate": {
      const isMaxEffort = weekNum % 2 !== 0;
      if (isMaxEffort) { pct = 0.90; reps = 3; label = "Conjugate Max Effort (90%)"; }
      else { pct = 0.55; reps = 2; label = "Conjugate Dynamic Speed (55%)"; }
      break;
    }
    default: {
      if (style === "powerlifter") {
        pct = 0.80; reps = 5; label = "Powerlifter Linear (80%)";
      } else {
        pct = 0.70; reps = 10; label = "Standard Linear (70%)";
      }
      break;
    }
  }

  const calculatedWeight = roundTo5(maxLift * pct);
  return { reps, weight: calculatedWeight, label, pct: Math.round(pct * 100), isBodyweight: false };
}

export function auditWorkoutBalance(workoutExercises) {
  const counts = { horizontalPush: 0, horizontalPull: 0, verticalPush: 0, verticalPull: 0, kneeDominant: 0, hipDominant: 0 };
  workoutExercises.forEach(ex => {
    const pattern = (ex.movement_pattern || '').toLowerCase();

    if (MOVEMENT_PATTERNS.HORIZONTAL_PUSH.includes(pattern)) counts.horizontalPush++;
    else if (MOVEMENT_PATTERNS.HORIZONTAL_PULL.includes(pattern)) counts.horizontalPull++;
    else if (MOVEMENT_PATTERNS.VERTICAL_PUSH.includes(pattern)) counts.verticalPush++;
    else if (MOVEMENT_PATTERNS.VERTICAL_PULL.includes(pattern)) counts.verticalPull++;
    else if (MOVEMENT_PATTERNS.KNEE_DOMINANT.includes(pattern)) counts.kneeDominant++;
    else if (MOVEMENT_PATTERNS.HIP_DOMINANT.includes(pattern)) counts.hipDominant++;
  });
  return counts;
}
