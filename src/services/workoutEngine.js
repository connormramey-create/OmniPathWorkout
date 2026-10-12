export const UPPER_BODY_TARGETS = [
  "chest", "upper chest", "lower chest", "pectorals", "lats", "upper back", 
  "shoulders", "front delts", "side delts", "rear delts", "traps", "biceps", 
  "brachialis", "triceps", "forearms"
];

export const LOWER_BODY_TARGETS = [
  "quads", "hamstrings", "glutes", "glute medius", "calves", "soleus", 
  "gastrocnemius", "adductors", "shin", "tibialis anterior", "abs", "obliques", "core", "lower back"
];

export const POWERLIFTER_COMPOUNDS = [
  "squat", "bench press", "deadlift", "overhead press", "barbell shoulder press", 
  "sumo deadlift", "front squat", "incline bench press"
];

export const INJURY_DATA = {
  none: { id: "none", name: "None / Healthy", contraindications: [], prehab_drills: [] },
  shoulder_rotator_cuff: {
    id: "shoulder_rotator_cuff",
    name: "Shoulder / Rotator Cuff Strain",
    contraindications: ["overhead", "vertical push", "dip", "upright row", "behind the neck"],
    prehab_drills: [
      { name: "Band Face Pulls", duration: "15 reps", desc: "Squeeze rear delts and externally rotate shoulders.", isPrehab: true },
      { name: "Shoulder Dislocates (Band/PVC)", duration: "12 reps", desc: "Keep arms straight while moving band overhead front-to-back.", isPrehab: true }
    ]
  },
  lower_back: {
    id: "lower_back",
    name: "Lower Back Strain / Lumbar Disc",
    contraindications: ["deadlift", "good morning", "squat", "hyperextension", "hinge", "row"],
    prehab_drills: [
      { name: "Bird-Dog Holds", duration: "10 per side", desc: "Extend opposite arm/leg with neutral spine.", isPrehab: true },
      { name: "McGill Curl-Ups", duration: "8 reps (5s hold)", desc: "Hands under lower back, brace core.", isPrehab: true }
    ]
  },
  knee_patellar: {
    id: "knee_patellar",
    name: "Knee / Patellar Tendonitis",
    contraindications: ["squat", "leg extension", "sissy squat", "jump squat", "lunge", "step-up"],
    prehab_drills: [
      { name: "Tibialis Bodyweight Raises", duration: "20 reps", desc: "Strengthen tibialis anterior to absorb impact.", isPrehab: true },
      { name: "Spanish Squat Iso-Holds", duration: "45 sec hold", desc: "Band behind knees to unweight patellar tendon.", isPrehab: true }
    ]
  },
  wrist_forearm: {
    id: "wrist_forearm",
    name: "Wrist / Forearm Tendonitis",
    contraindications: ["barbell curl", "wrist curl", "straight bar"],
    prehab_drills: [
      { name: "Dynamic Wrist Sweeps", duration: "15 per side", desc: "Promote blood flow through wrist extensors.", isPrehab: true }
    ]
  }
};

export const DYNAMIC_WARMUP_LIBRARY = {
  chest: [{ name: "Arm Swings & Chest Openers", duration: "45 sec", desc: "Cross arms across chest, pull back dynamically." }],
  shoulders: [{ name: "Arm Circles (Forward & Reverse)", duration: "30 sec each", desc: "Rotational shoulder warmup." }],
  lats: [{ name: "Lat Overhead Side Reaches", duration: "10 per side", desc: "Side bend with overhead reach." }],
  quads: [{ name: "Goblet Squat Hold w/ Pry", duration: "45 sec", desc: "Sink deep into squat, gently pry knees out." }],
  hamstrings: [{ name: "Frankenstein Dynamic Sweeps", duration: "10 per leg", desc: "Hinge forward and sweep toes." }],
  glutes: [{ name: "Glute Bridges", duration: "15 reps", desc: "Squeeze glutes at top pause." }]
};

export const COOL_DOWN_STRETCH_LIBRARY = {
  chest: [{ name: "Doorway Pectoral Stretch", duration: "45 sec hold", desc: "Lean forward in doorway to stretch chest." }],
  shoulders: [{ name: "Cross-Body Shoulder Stretch", duration: "45 sec per side", desc: "Pull arm across chest." }],
  lats: [{ name: "Child's Pose w/ Lateral Reach", duration: "60 sec hold", desc: "Walk hands diagonally to stretch lats." }],
  quads: [{ name: "Standing Quad Stretch", duration: "45 sec per side", desc: "Hold foot to glute." }],
  hamstrings: [{ name: "Seated Hamstring Stretch", duration: "45 sec per side", desc: "Fold forward from hips." }],
  glutes: [{ name: "Pigeon Stretch", duration: "45 sec per side", desc: "Cross ankle over knee, lean forward." }]
};

export const CALISTHENICS_SKILL_TREES = {
  push: [
    { level: 1, name: "Push-Up", target: "chest", reps: "8-12 reps" },
    { level: 2, name: "Diamond Push-Up", target: "triceps", reps: "8-12 reps" },
    { level: 3, name: "Pike Push-Up", target: "shoulders", reps: "6-10 reps" },
    { level: 4, name: "Elevated Pike Push-Up", target: "shoulders", reps: "5-8 reps" },
    { level: 5, name: "Handstand Push-Up (Wall)", target: "shoulders", reps: "3-5 reps" }
  ],
  pull: [
    { level: 1, name: "Australian Inverted Row", target: "upper back", reps: "8-12 reps" },
    { level: 2, name: "Chin-Up", target: "biceps", reps: "6-10 reps" },
    { level: 3, name: "Pull-Up", target: "lats", reps: "5-8 reps" },
    { level: 4, name: "Archer Pull-Up", target: "lats", reps: "4-6 reps" },
    { level: 5, name: "Muscle-Up", target: "lats", reps: "2-4 reps" }
  ],
  legs: [
    { level: 1, name: "Air Squat", target: "quads", reps: "15-20 reps" },
    { level: 2, name: "Bulgarian Split Squat", target: "quads", reps: "8-12 reps" },
    { level: 3, name: "Shrimp Squat", target: "quads", reps: "5-8 reps" },
    { level: 4, name: "Pistol Squat", target: "quads", reps: "3-6 reps" }
  ]
};

export const DEFAULT_MAX_LIFTS = { benchPress: 185, squat: 225, deadlift: 275, overheadPress: 115 };

export const DEFAULT_SETTINGS = {
  profile: "standard",
  progressionScheme: "linear",
  split: "upper_lower",
  duration: 45,
  restTime: 60,
  equipment: ["barbell", "dumbbell", "cable", "leverage machine", "smith machine", "body weight", "kettlebell", "band", "other"],
  supersets: false,
  maxLifts: DEFAULT_MAX_LIFTS,
  selectedInjury: "none",
  autoStartTimer: true,
  calisthenicsUnlocked: { push: [1], pull: [1], legs: [1] }
};

export const DEFAULT_EXERCISES = [
  { id: "bench_press", name: "Barbell Bench Press", target: "chest", equipment: "barbell", movement_pattern: "horizontal push" },
  { id: "barbell_row", name: "Barbell Bent-Over Row", target: "upper back", equipment: "barbell", movement_pattern: "horizontal pull" },
  { id: "overhead_press", name: "Overhead Barbell Press", target: "shoulders", equipment: "barbell", movement_pattern: "vertical push" },
  { id: "lat_pulldown", name: "Cable Lat Pulldown", target: "lats", equipment: "cable", movement_pattern: "vertical pull" },
  { id: "barbell_squat", name: "Barbell Back Squat", target: "quads", equipment: "barbell", movement_pattern: "squat" },
  { id: "romanian_deadlift", name: "Romanian Deadlift", target: "hamstrings", equipment: "barbell", movement_pattern: "hinge" },
  { id: "db_bicep_curl", name: "Dumbbell Bicep Curl", target: "biceps", equipment: "dumbbell", movement_pattern: "pull" },
  { id: "tricep_rope_pushdown", name: "Cable Tricep Pushdown", target: "triceps", equipment: "cable", movement_pattern: "push" },
  { id: "push_up", name: "Push-Up", target: "chest", equipment: "body weight", movement_pattern: "horizontal push" },
  { id: "pull_up", name: "Pull-Up", target: "lats", equipment: "body weight", movement_pattern: "vertical pull" }
];

export function roundTo5(val) {
  return Math.max(10, Math.round(val / 5) * 5);
}

export function isExerciseContraindicated(ex, injuryKey) {
  const injuryInfo = INJURY_DATA[injuryKey || "none"];
  if (!injuryInfo || !injuryInfo.contraindications || injuryInfo.contraindications.length === 0) {
    return false;
  }
  const name = (ex.name || "").toLowerCase();
  const pattern = (ex.movement_pattern || "").toLowerCase();
  const target = (ex.target || "").toLowerCase();

  return injuryInfo.contraindications.some((c) => 
    name.includes(c) || pattern.includes(c) || target.includes(c)
  );
}

export function getExerciseMaxLift(ex, userSettings) {
  const maxes = userSettings?.maxLifts || DEFAULT_MAX_LIFTS;
  const name = (ex.name || "").toLowerCase();
  const target = (ex.target || "").toLowerCase();

  if (name.includes("bench") || target.includes("chest")) return parseFloat(maxes.benchPress) || 185;
  if (name.includes("squat") || target.includes("quad")) return parseFloat(maxes.squat) || 225;
  if (name.includes("deadlift") || target.includes("hamstring")) return parseFloat(maxes.deadlift) || 275;
  if (name.includes("press") || target.includes("shoulder")) return parseFloat(maxes.overheadPress) || 115;
  return 135;
}

export function calculateProgressionSetTargets(exercise, scheme, weekNum, setIdx, userSettings) {
  if (userSettings?.profile === "calisthenics") {
    return { reps: 10, weight: 0, label: "Bodyweight Flow", isBodyweight: true };
  }

  const maxLift = getExerciseMaxLift(exercise, userSettings);
  let pct = 0.70;
  let reps = 10;
  let label = "Linear";

  if (scheme === "five_three_one") {
    const weekCycle = ((weekNum - 1) % 4) + 1;
    if (weekCycle === 1) {
      pct = [0.65, 0.75, 0.85][Math.min(setIdx, 2)]; reps = 5;
      label = `5/3/1 W1 Set ${setIdx + 1} (${Math.round(pct * 100)}%)`;
    } else if (weekCycle === 2) {
      pct = [0.70, 0.80, 0.90][Math.min(setIdx, 2)]; reps = 3;
      label = `5/3/1 W2 Set ${setIdx + 1} (${Math.round(pct * 100)}%)`;
    } else if (weekCycle === 3) {
      pct = [0.75, 0.85, 0.95][Math.min(setIdx, 2)]; reps = [5, 3, 1][Math.min(setIdx, 2)];
      label = `5/3/1 W3 Set ${setIdx + 1} (${Math.round(pct * 100)}%)`;
    } else {
      pct = 0.50; reps = 5; label = "5/3/1 Deload (50%)";
    }
  } else if (scheme === "juggernaut") {
    const wave = Math.ceil((weekNum % 16) / 4) || 1;
    if (weekNum % 4 === 0) { pct = 0.50; reps = 5; label = "Juggernaut Deload (50%)"; }
    else if (wave === 1) { pct = 0.70; reps = 10; label = "Juggernaut 10s (70%)"; }
    else if (wave === 2) { pct = 0.75; reps = 8; label = "Juggernaut 8s (75%)"; }
    else if (wave === 3) { pct = 0.80; reps = 5; label = "Juggernaut 5s (80%)"; }
    else { pct = 0.85; reps = 3; label = "Juggernaut 3s (85%)"; }
  } else if (scheme === "conjugate") {
    const isMax = weekNum % 2 !== 0;
    pct = isMax ? 0.90 : 0.55;
    reps = isMax ? 3 : 2;
    label = isMax ? "Conjugate Max Effort (90%)" : "Conjugate Speed (55%)";
  } else {
    pct = userSettings?.profile === "powerlifter" ? 0.80 : 0.70;
    reps = userSettings?.profile === "powerlifter" ? 5 : 10;
    label = `${(userSettings?.profile || "STANDARD").toUpperCase()} Linear (${Math.round(pct * 100)}%)`;
  }

  const calculatedWeight = roundTo5(maxLift * pct);
  return { reps, weight: calculatedWeight, label, pct: Math.round(pct * 100), isBodyweight: false };
}

export function generateWorkoutSession(userSettings, customExercises = [], splitOverride = null) {
  const profile = userSettings.profile || "standard";
  const split = splitOverride || userSettings.split;
  const duration = parseInt(userSettings.duration, 10);
  const count = Math.max(3, Math.floor(duration / 7.5));

  let dataset = [...DEFAULT_EXERCISES, ...customExercises];

  // Apply Injury Contraindications Filter
  if (userSettings.selectedInjury && userSettings.selectedInjury !== "none") {
    dataset = dataset.filter((ex) => !isExerciseContraindicated(ex, userSettings.selectedInjury));
  }

  let available = [];
  if (profile === "calisthenics") {
    available = dataset.filter((ex) => (ex.equipment || "").toLowerCase() === "body weight");
  } else {
    const activeEquip = (userSettings.equipment || []).map((e) => e.toLowerCase().trim());
    available = dataset.filter((ex) => activeEquip.includes((ex.equipment || "").toLowerCase().trim()));
    if (profile === "powerlifter") {
      available = available.filter((ex) => POWERLIFTER_COMPOUNDS.some((c) => ex.name.toLowerCase().includes(c)));
    }
  }

  let targetMuscles = [];
  let title = `${profile.toUpperCase()} SESSION`;

  if (split === "upper") { targetMuscles = UPPER_BODY_TARGETS; title = "UPPER BODY SESSION"; }
  else if (split === "lower") { targetMuscles = LOWER_BODY_TARGETS; title = "LOWER BODY SESSION"; }
  else if (split === "ppl_push") { targetMuscles = ["chest", "shoulders", "triceps"]; title = "PUSH ONLY SESSION"; }
  else if (split === "ppl_pull") { targetMuscles = ["lats", "upper back", "biceps"]; title = "PULL ONLY SESSION"; }
  else if (split === "ppl_legs") { targetMuscles = ["quads", "hamstrings", "glutes", "calves"]; title = "LEGS ONLY SESSION"; }
  else if (split === "ppl") { title = "PPL COMBINED SESSION"; }

  let pool = available;
  if (targetMuscles.length > 0) {
    pool = available.filter((ex) => targetMuscles.includes((ex.target || "").toLowerCase().trim()));
  }
  if (pool.length < count) pool = available.length > 0 ? available : dataset;

  let selected = [];
  let poolCopy = [...pool];
  while (selected.length < count && poolCopy.length > 0) {
    selected.push(poolCopy.splice(Math.floor(Math.random() * poolCopy.length), 1)[0]);
  }

  const injuryInfo = INJURY_DATA[userSettings.selectedInjury || "none"];
  const warmups = injuryInfo?.prehab_drills ? [...injuryInfo.prehab_drills] : [];
  selected.forEach((ex) => {
    const t = (ex.target || "").toLowerCase();
    if (t.includes("chest") && DYNAMIC_WARMUP_LIBRARY.chest) warmups.push(...DYNAMIC_WARMUP_LIBRARY.chest);
    if (t.includes("quad") && DYNAMIC_WARMUP_LIBRARY.quads) warmups.push(...DYNAMIC_WARMUP_LIBRARY.quads);
  });

  const cooldowns = [];
  selected.forEach((ex) => {
    const t = (ex.target || "").toLowerCase();
    if (t.includes("chest") && COOL_DOWN_STRETCH_LIBRARY.chest) cooldowns.push(...COOL_DOWN_STRETCH_LIBRARY.chest);
  });

  return { title, exercises: selected, warmups, cooldowns };
}
