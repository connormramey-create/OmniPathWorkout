import exercisesData from '../data/exercises.json';
import injuryDataset from '../data/injuries.json';

export const DEFAULT_MAX_LIFTS = {
  benchPress: 185,
  squat: 225,
  deadlift: 275,
  overheadPress: 115
};

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

export const DYNAMIC_WARMUP_LIBRARY = {
  chest: [
    { name: "Arm Swings & Chest Openers", duration: "45 sec", desc: "Cross arms across chest, then pull back dynamically to open pectorals." },
    { name: "Band Pull-Aparts", duration: "15 reps", desc: "Hold light band at chest height, pull outward focusing on upper back activation." }
  ],
  shoulders: [
    { name: "Shoulder Dislocates (PVC/Band)", duration: "12 reps", desc: "Pass band overhead from front to back with straight arms." },
    { name: "Arm Circles (Forward & Reverse)", duration: "30 sec each", desc: "Small to large arm rotations to warm rotator cuff muscles." }
  ],
  lats: [
    { name: "Lat Overhead Side Reaches", duration: "10 per side", desc: "Side bend with overhead reach to dynamically stretch lats." },
    { name: "Cat-Cow Stretch", duration: "10 reps", desc: "Flex and extend spine to articulate thoracic spine and lats." }
  ],
  quads: [
    { name: "Bodyweight Goblet Squat Hold w/ Pry", duration: "45 sec", desc: "Sink into deep squat, gently prying knees out with elbows." },
    { name: "Dynamic Walking Quad Stretch", duration: "10 per leg", desc: "Pull foot to glute while reaching opposite hand overhead." }
  ],
  hamstrings: [
    { name: "Frankenstein Dynamic Sweeps", duration: "10 per leg", desc: "Hinge forward and sweep hands toward toes on extended heel." },
    { name: "Good Morning Hip Hinges", duration: "12 reps", desc: "Hands behind head, hinge at hips with flat back to prime posterior chain." }
  ],
  glutes: [
    { name: "Bodyweight Glute Bridges", duration: "15 reps", desc: "Squeeze glutes at top pause to prime posterior chain." },
    { name: "Hip Openers / Fire Hydrants", duration: "10 per leg", desc: "Circle knees outward on all fours to activate glute medius." }
  ]
};

export const COOL_DOWN_STRETCH_LIBRARY = {
  chest: [{ name: "Doorway Pectoral Stretch", duration: "45 sec hold", desc: "Place forearm against doorframe, step forward to stretch chest." }],
  shoulders: [{ name: "Cross-Body Shoulder Stretch", duration: "45 sec per side", desc: "Pull arm across chest with opposite arm." }],
  lats: [{ name: "Child's Pose w/ Lateral Reach", duration: "60 sec hold", desc: "Kneel, sit hips back, and walk hands diagonally to stretch lats." }],
  quads: [{ name: "Standing / Lying Quad Stretch", duration: "45 sec per side", desc: "Hold foot to glute, keeping knees together and core tight." }],
  hamstrings: [{ name: "Seated Single-Leg Hamstring Stretch", duration: "45 sec per side", desc: "Extend one leg, fold forward from hips with flat spine." }],
  glutes: [{ name: "Figure-Four / Pigeon Stretch", duration: "45 sec per side", desc: "Cross ankle over knee, lean forward to stretch deep glutes." }]
};

export function isExerciseContraindicated(ex, injuryId) {
  const activeInj = injuryDataset[injuryId || "none"];
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

export function roundTo5(weight) {
  return Math.max(10, Math.round(weight / 5) * 5);
}

export function calculateProgressionSetTargets(exercise, scheme = "linear", weekNum = 1, setIdx = 0, style = "standard", maxLifts = DEFAULT_MAX_LIFTS) {
  if (style === "calisthenics") {
    return { reps: 10, weight: 0, label: "Natural Bodyweight Flow", isBodyweight: true };
  }

  const maxLift = getExerciseMaxLift(exercise, maxLifts);
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

export function generateTargetedMobility(workoutExercises, injuryId = "none") {
  const targetMuscles = new Set();
  workoutExercises.forEach(ex => {
    const target = (ex.target || ex.muscle_group || '').toLowerCase();
    if (target.includes('chest')) targetMuscles.add('chest');
    if (target.includes('shoulder')) targetMuscles.add('shoulders');
    if (target.includes('lat') || target.includes('back')) targetMuscles.add('lats');
    if (target.includes('quad')) targetMuscles.add('quads');
    if (target.includes('hamstring')) targetMuscles.add('hamstrings');
    if (target.includes('glute')) targetMuscles.add('glutes');
  });

  if (targetMuscles.size === 0) targetMuscles.add('shoulders');

  const warmups = [];
  const cooldowns = [];

  const activeInj = injuryDataset[injuryId];
  if (activeInj && activeInj.prehab_drills && activeInj.prehab_drills.length > 0) {
    warmups.push(...activeInj.prehab_drills);
  }

  targetMuscles.forEach(m => {
    if (DYNAMIC_WARMUP_LIBRARY[m]) warmups.push(...DYNAMIC_WARMUP_LIBRARY[m]);
    if (COOL_DOWN_STRETCH_LIBRARY[m]) cooldowns.push(...COOL_DOWN_STRETCH_LIBRARY[m]);
  });

  return { warmups, cooldowns };
}

export function generateWorkoutSession(options = {}) {
  const {
    style = "standard",
    split = "upper_lower",
    duration = 45,
    equipment = ["barbell", "dumbbell", "cable", "body weight"],
    injuryId = "none",
    supersets = false,
    calisthenicsSkills = ["Push-Up", "Australian Inverted Row", "Air Squat"],
    customExercises = [],
    isDeloadWeek = false
  } = options;

  let exerciseCount = Math.max(3, Math.floor(duration / 7.5));
  if (isDeloadWeek) {
    exerciseCount = Math.max(2, Math.floor(exerciseCount * 0.8));
  }

  const mergedDataset = [
    ...exercisesData.filter(ex => !ex.isCustom),
    ...customExercises.map(ex => ({ ...ex, isCustom: true }))
  ];

  let activeEquipment = equipment.map(e => e.toLowerCase().trim());
  if (style === "calisthenics") {
    activeEquipment = ["body weight", "bodyweight"];
  }

  let availableExercises = mergedDataset.filter(ex => 
    activeEquipment.includes((ex.equipment || '').toLowerCase().trim()) &&
    !isExerciseContraindicated(ex, injuryId)
  );

  if (style === "powerlifter") {
    availableExercises = availableExercises.filter(ex => {
      const name = (ex.name || '').toLowerCase();
      return POWERLIFTER_COMPOUNDS.some(c => name.includes(c)) || 
             ['squat', 'bench', 'press', 'deadlift', 'row'].some(k => name.includes(k));
    });
  }

  if (style === "calisthenics") {
    const allowedCalisthenicsNames = new Set(calisthenicsSkills);
    Object.values(CALISTHENICS_SKILL_TREES).forEach(tree => {
      tree.forEach((step, idx) => {
        if (calisthenicsSkills.includes(step.name) && idx + 1 < tree.length) {
          allowedCalisthenicsNames.add(tree[idx + 1].name);
        }
      });
    });

    availableExercises = availableExercises.filter(ex => 
      allowedCalisthenicsNames.has(ex.name) || (ex.equipment || '').toLowerCase().includes('body')
    );
  }

  let poolCopy = [...availableExercises];
  if (poolCopy.length === 0) poolCopy = [...mergedDataset];

  const selected = [];

  if (supersets) {
    let pairCount = 1;
    while (selected.length < exerciseCount && poolCopy.length > 0) {
      const ex1Idx = Math.floor(Math.random() * poolCopy.length);
      const ex1 = poolCopy.splice(ex1Idx, 1)[0];
      const target1 = (ex1.target || '').toLowerCase();
      
      ex1.supersetGroup = `SUPERSET ${pairCount} - A`;
      selected.push(ex1);

      if (selected.length >= exerciseCount) break;

      const antagonists = ANTAGONIST_MAP[target1] || [];
      let ex2Idx = poolCopy.findIndex(ex => antagonists.includes((ex.target || '').toLowerCase()));

      if (ex2Idx !== -1) {
        const ex2 = poolCopy.splice(ex2Idx, 1)[0];
        ex2.supersetGroup = `SUPERSET ${pairCount} - B`;
        selected.push(ex2);
      } else if (poolCopy.length > 0) {
        const ex2 = poolCopy.splice(0, 1)[0];
        ex2.supersetGroup = `SUPERSET ${pairCount} - B`;
        selected.push(ex2);
      }
      pairCount++;
    }
  } else {
    while (selected.length < exerciseCount && poolCopy.length > 0) {
      const idx = Math.floor(Math.random() * poolCopy.length);
      selected.push(poolCopy.splice(idx, 1)[0]);
    }
  }

  return {
    title: `${style.toUpperCase()} - ${split.toUpperCase().replace('_', ' ')} SESSION`,
    exercises: selected,
    isDeloadWeek
  };
}
