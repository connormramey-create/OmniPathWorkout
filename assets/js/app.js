// ==========================================
// OmniPathWorkout - IRON BRO TRACKER MASTER
// ==========================================

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA1fJ7pOsNQvmFQVXhFKji62c3TUbYfymg",
  authDomain: "omnipathworkout.firebaseapp.com",
  projectId: "omnipathworkout",
  storageBucket: "omnipathworkout.firebasestorage.app",
  messagingSenderId: "868629854877",
  appId: "1:868629854877:web:2d7d74b54fc4e913e47274",
  measurementId: "G-9YDR5HP3DQ"
};

// Initialize Firebase Services
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// State Management
let exerciseDataset = [];
let injuryDataset = {};
let activeWorkout = null;
let timerInterval = null;
let timerRemainingSeconds = 0;
let isTimerPaused = false;
let currentUser = null;
let isSignUpMode = false;
let activePickerTarget = null; // { weekNum, dayId, slotIdx }

const DEFAULT_MAX_LIFTS = {
  benchPress: 185,
  squat: 225,
  deadlift: 275,
  overheadPress: 115
};

const DEFAULT_SETTINGS = {
  workoutStyle: "standard",       // "standard", "powerlifter", "calisthenics", "program_builder"
  selectedInjury: "none",         // "none", "shoulder_rotator_cuff", "lower_back", "knee_patellar", "wrist_forearm"
  progressionScheme: "linear",   // "linear", "five_three_one", "juggernaut", "conjugate"
  split: "upper_lower",
  duration: 45,
  restTime: 60,
  equipment: ["barbell", "dumbbell", "cable", "leverage machine", "smith machine", "body weight", "kettlebell", "band", "other"],
  supersets: false,
  maxLifts: DEFAULT_MAX_LIFTS
};

let userSettings = JSON.parse(localStorage.getItem("gymbro_settings")) || DEFAULT_SETTINGS;

if (userSettings.profile && !userSettings.workoutStyle) {
  userSettings.workoutStyle = userSettings.profile;
}
if (!userSettings.selectedInjury) userSettings.selectedInjury = "none";
if (!userSettings.maxLifts) userSettings.maxLifts = DEFAULT_MAX_LIFTS;

let activePlan = null;
let workoutHistory = JSON.parse(localStorage.getItem("gymbro_history")) || [];
let exerciseHistory = JSON.parse(localStorage.getItem("gymbro_exercise_history")) || {};
let customExercises = JSON.parse(localStorage.getItem("gymbro_custom_exercises")) || [];
let calisthenicsCheckedSkills = JSON.parse(localStorage.getItem("gymbro_calisthenics_skills")) || ["Push-Up", "Australian Inverted Row", "Air Squat"];

// Muscle & Movement Maps
const UPPER_BODY_TARGETS = ["chest", "upper chest", "lower chest", "pectorals", "lats", "upper back", "shoulders", "front delts", "side delts", "rear delts", "traps", "biceps", "brachialis", "triceps", "forearms"];
const LOWER_BODY_TARGETS = ["quads", "hamstrings", "glutes", "glute medius", "calves", "soleus", "gastrocnemius", "adductors", "shin", "tibialis anterior", "abs", "obliques", "core", "lower back"];
const POWERLIFTER_COMPOUNDS = ["squat", "bench press", "deadlift", "overhead press", "barbell shoulder press", "sumo deadlift", "front squat", "incline bench press"];

const ANTAGONIST_MAP = {
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

const MOVEMENT_PATTERNS = {
  HORIZONTAL_PUSH: ['horizontal push'],
  HORIZONTAL_PULL: ['horizontal pull'],
  VERTICAL_PUSH: ['vertical push'],
  VERTICAL_PULL: ['vertical pull'],
  KNEE_DOMINANT: ['squat', 'knee extension'],
  HIP_DOMINANT: ['hinge', 'hip extension', 'knee flexion']
};

const CALISTHENICS_SKILL_TREES = {
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

const DYNAMIC_WARMUP_LIBRARY = {
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

const COOL_DOWN_STRETCH_LIBRARY = {
  chest: [{ name: "Doorway Pectoral Stretch", duration: "45 sec hold", desc: "Place forearm against doorframe, step forward to stretch chest." }],
  shoulders: [{ name: "Cross-Body Shoulder Stretch", duration: "45 sec per side", desc: "Pull arm across chest with opposite arm." }],
  lats: [{ name: "Child's Pose w/ Lateral Reach", duration: "60 sec hold", desc: "Kneel, sit hips back, and walk hands diagonally to stretch lats." }],
  quads: [{ name: "Standing / Lying Quad Stretch", duration: "45 sec per side", desc: "Hold foot to glute, keeping knees together and core tight." }],
  hamstrings: [{ name: "Seated Single-Leg Hamstring Stretch", duration: "45 sec per side", desc: "Extend one leg, fold forward from hips with flat spine." }],
  glutes: [{ name: "Figure-Four / Pigeon Stretch", duration: "45 sec per side", desc: "Cross ankle over knee, lean forward to stretch deep glutes." }]
};

function getPlanStorageKey() {
  const style = userSettings.workoutStyle || "standard";
  return `gymbro_active_plan_${style}`;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
  await loadInjuries();
  await loadExercises();
  applyProfileThemeAndRules();
  initSettingsUI();
  initEventListeners();
  initFirebaseAuthListener();
  renderPlanUI();
  renderHistoryUI();
  renderCalisthenicsPathwaysTab();
  checkActiveSession();
});

async function loadInjuries() {
  try {
    const res = await fetch("data/injuries.json");
    injuryDataset = await res.json();
  } catch (err) {
    console.error("Failed to load injuries dataset:", err);
  }
}

async function loadExercises() {
  try {
    const response = await fetch("data/exercises.json");
    exerciseDataset = await response.json();
    mergeCustomExercises();
  } catch (err) {
    console.error("Failed to load exercises dataset:", err);
  }
}

function mergeCustomExercises() {
  exerciseDataset = exerciseDataset.filter(ex => !ex.isCustom);
  const taggedCustoms = customExercises.map(ex => ({ ...ex, isCustom: true }));
  exerciseDataset = [...exerciseDataset, ...taggedCustoms];
}

function isExerciseContraindicated(ex, injuryId) {
  const activeInj = injuryDataset[injuryId || userSettings.selectedInjury];
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

function onWorkoutStyleChangeUI(style) {
  const schemeGroup = document.getElementById("progression-scheme-group");
  const maxLiftsGroup = document.getElementById("max-lifts-group");
  const calisthenicsCard = document.getElementById("calisthenics-flow-info");
  const calisthenicsTabBtn = document.getElementById("calisthenics-tab-btn");
  const stdPlanSetup = document.getElementById("standard-plan-setup-card");
  const pbWizardCard = document.getElementById("program-builder-wizard-card");

  if (style === "calisthenics") {
    if (schemeGroup) schemeGroup.classList.add("hidden");
    if (maxLiftsGroup) maxLiftsGroup.classList.add("hidden");
    if (calisthenicsCard) calisthenicsCard.classList.remove("hidden");
    if (calisthenicsTabBtn) calisthenicsTabBtn.classList.remove("hidden");
    if (stdPlanSetup) stdPlanSetup.classList.remove("hidden");
    if (pbWizardCard) pbWizardCard.classList.add("hidden");
  } else if (style === "program_builder") {
    if (schemeGroup) schemeGroup.classList.remove("hidden");
    if (maxLiftsGroup) maxLiftsGroup.classList.remove("hidden");
    if (calisthenicsCard) calisthenicsCard.classList.add("hidden");
    if (calisthenicsTabBtn) calisthenicsTabBtn.classList.add("hidden");
    if (stdPlanSetup) stdPlanSetup.classList.add("hidden");
    if (pbWizardCard) pbWizardCard.classList.remove("hidden");
  } else {
    if (schemeGroup) schemeGroup.classList.remove("hidden");
    if (maxLiftsGroup) maxLiftsGroup.classList.remove("hidden");
    if (calisthenicsCard) calisthenicsCard.classList.add("hidden");
    if (calisthenicsTabBtn) calisthenicsTabBtn.classList.add("hidden");
    if (stdPlanSetup) stdPlanSetup.classList.remove("hidden");
    if (pbWizardCard) pbWizardCard.classList.add("hidden");
  }
}

function applyProfileThemeAndRules() {
  const body = document.body;
  const style = userSettings.workoutStyle || "standard";
  
  body.classList.remove("theme-standard", "theme-powerlifter", "theme-calisthenics", "theme-program-builder");
  
  if (style === "powerlifter") {
    body.classList.add("theme-powerlifter");
    document.getElementById("app-subhead").innerText = "POWERLIFTER";
  } else if (style === "calisthenics") {
    body.classList.add("theme-calisthenics");
    document.getElementById("app-subhead").innerText = "CALISTHENICS";
  } else if (style === "program_builder") {
    body.classList.add("theme-program-builder");
    document.getElementById("app-subhead").innerText = "PROGRAM BUILDER";
  } else {
    body.classList.add("theme-standard");
    document.getElementById("app-subhead").innerText = "TRACKER";
  }

  onWorkoutStyleChangeUI(style);
}

function initFirebaseAuthListener() {
  auth.onAuthStateChanged(async (user) => {
    const authModal = document.getElementById("auth-modal");
    if (user) {
      currentUser = user;
      if (authModal) authModal.classList.add("hidden");
      syncUserDataFromCloud(user.uid);
    } else {
      currentUser = null;
      if (authModal) authModal.classList.remove("hidden");
    }
  });
}

function syncUserDataFromCloud(uid) {
  const userRef = db.ref(`users/${uid}`);
  userRef.on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
      if (data.settings) {
        userSettings = data.settings;
        if (!userSettings.selectedInjury) userSettings.selectedInjury = "none";
        if (!userSettings.maxLifts) userSettings.maxLifts = DEFAULT_MAX_LIFTS;
        localStorage.setItem("gymbro_settings", JSON.stringify(userSettings));
        applyProfileThemeAndRules();
        initSettingsUI();
      }
      if (data.history) {
        workoutHistory = data.history;
        localStorage.setItem("gymbro_history", JSON.stringify(workoutHistory));
        renderHistoryUI();
      }
      const style = userSettings.workoutStyle || "standard";
      if (data.plans && data.plans[style]) {
        activePlan = data.plans[style];
        localStorage.setItem(getPlanStorageKey(), JSON.stringify(activePlan));
        renderPlanUI();
      }
      if (data.exercise_history) {
        exerciseHistory = data.exercise_history;
        localStorage.setItem("gymbro_exercise_history", JSON.stringify(exerciseHistory));
      }
      if (data.custom_exercises) {
        customExercises = data.custom_exercises;
        localStorage.setItem("gymbro_custom_exercises", JSON.stringify(customExercises));
        mergeCustomExercises();
      }
      if (data.calisthenics_skills) {
        calisthenicsCheckedSkills = data.calisthenics_skills;
        localStorage.setItem("gymbro_calisthenics_skills", JSON.stringify(calisthenicsCheckedSkills));
        renderCalisthenicsPathwaysTab();
      }
    }
  });
}

function saveUserDataToCloud() {
  if (!currentUser) return;
  const style = userSettings.workoutStyle || "standard";
  
  db.ref(`users/${currentUser.uid}`).update({
    settings: userSettings,
    history: workoutHistory,
    exercise_history: exerciseHistory,
    custom_exercises: customExercises,
    calisthenics_skills: calisthenicsCheckedSkills
  });

  if (activePlan) {
    db.ref(`users/${currentUser.uid}/plans/${style}`).set(activePlan);
  }
}

// Sound Alert & Haptic Feedback Engine
function playRestTimerFinishSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(1760, ctx.currentTime);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 1.2);
    osc2.stop(ctx.currentTime + 1.2);
  } catch (err) {
    console.error("Audio error:", err);
  }

  if ("vibrate" in navigator) {
    navigator.vibrate([200, 100, 200, 100, 400]);
  }
}

// Rest Timer Engine
function startRestTimer(seconds) {
  clearInterval(timerInterval);
  timerRemainingSeconds = seconds || parseInt(userSettings.restTime || 60, 10);
  isTimerPaused = false;

  updateTimerButtonsUI();
  const stickyBar = document.getElementById("sticky-timer-bar");
  if (stickyBar) stickyBar.classList.remove("hidden");

  const tick = () => {
    if (isTimerPaused) return;

    const mins = Math.floor(timerRemainingSeconds / 60);
    const secs = timerRemainingSeconds % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const modalDisplay = document.getElementById("rest-timer-display");
    const floatingDisplay = document.getElementById("floating-timer-display");

    if (modalDisplay) modalDisplay.innerText = formatted;
    if (floatingDisplay) floatingDisplay.innerText = formatted;

    if (timerRemainingSeconds <= 0) {
      clearInterval(timerInterval);
      if (modalDisplay) modalDisplay.innerText = "TIME UP!";
      if (floatingDisplay) floatingDisplay.innerText = "TIME UP!";
      playRestTimerFinishSound();
      setTimeout(() => { if (stickyBar) stickyBar.classList.add("hidden"); }, 5000);
      return;
    }
    timerRemainingSeconds--;
  };

  tick();
  timerInterval = setInterval(tick, 1000);
}

function adjustRestTimer(secondsToAdd) {
  timerRemainingSeconds = Math.max(0, timerRemainingSeconds + secondsToAdd);
  const mins = Math.floor(timerRemainingSeconds / 60);
  const secs = timerRemainingSeconds % 60;
  const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const modalDisplay = document.getElementById("rest-timer-display");
  const floatingDisplay = document.getElementById("floating-timer-display");

  if (modalDisplay) modalDisplay.innerText = formatted;
  if (floatingDisplay) floatingDisplay.innerText = formatted;
}

function togglePauseRestTimer() {
  isTimerPaused = !isTimerPaused;
  updateTimerButtonsUI();
}

function updateTimerButtonsUI() {
  const modalBtn = document.getElementById("modal-pause-btn");
  const stickyBtn = document.getElementById("timer-pause-btn");
  const label = isTimerPaused ? "RESUME" : "PAUSE";
  if (modalBtn) modalBtn.innerText = label;
  if (stickyBtn) stickyBtn.innerText = label;
}

function skipRestTimer() {
  clearInterval(timerInterval);
  timerRemainingSeconds = 0;
  document.getElementById("rest-timer-display").innerText = "00:00";
  document.getElementById("floating-timer-display").innerText = "00:00";
  document.getElementById("sticky-timer-bar").classList.add("hidden");
}

function getExerciseMaxLift(exercise) {
  const maxes = userSettings.maxLifts || DEFAULT_MAX_LIFTS;
  const name = (exercise.name || '').toLowerCase();
  const target = (exercise.target || '').toLowerCase();

  if (name.includes('bench') || name.includes('chest press') || target.includes('chest')) {
    return parseFloat(maxes.benchPress) || 185;
  }
  if (name.includes('squat') || name.includes('leg press') || target.includes('quad')) {
    return parseFloat(maxes.squat) || 225;
  }
  if (name.includes('deadlift') || name.includes('rdl') || name.includes('hip thrust') || target.includes('hamstring')) {
    return parseFloat(maxes.deadlift) || 275;
  }
  if (name.includes('press') || name.includes('shoulder') || target.includes('shoulder')) {
    return parseFloat(maxes.overheadPress) || 115;
  }
  return 135;
}

function roundTo5(weight) {
  return Math.max(10, Math.round(weight / 5) * 5);
}

function calculateProgressionSetTargets(exercise, scheme, weekNum, setIdx) {
  const style = userSettings.workoutStyle || "standard";

  if (style === "calisthenics") {
    return { reps: 10, weight: 0, label: "Natural Bodyweight Flow", isBodyweight: true };
  }

  const maxLift = getExerciseMaxLift(exercise);
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

// ROUTINE GENERATOR
function generateWorkoutSession(splitTypeOverride, isDeloadWeek = false) {
  mergeCustomExercises();

  const style = userSettings.workoutStyle || "standard";
  const split = splitTypeOverride || userSettings.split;
  const duration = parseInt(userSettings.duration, 10);
  let exerciseCount = Math.max(3, Math.floor(duration / 7.5));

  if (isDeloadWeek) {
    exerciseCount = Math.max(2, Math.floor(exerciseCount * 0.8));
  }

  let activeEquipment = userSettings.equipment.map(e => e.toLowerCase().trim());
  if (style === "calisthenics") {
    activeEquipment = ["body weight", "bodyweight"];
  }

  let availableExercises = exerciseDataset.filter(ex => 
    activeEquipment.includes((ex.equipment || '').toLowerCase().trim()) &&
    !isExerciseContraindicated(ex)
  );

  if (style === "powerlifter") {
    availableExercises = availableExercises.filter(ex => {
      const name = (ex.name || '').toLowerCase();
      return POWERLIFTER_COMPOUNDS.some(c => name.includes(c)) || 
             ['squat', 'bench', 'press', 'deadlift', 'row'].some(k => name.includes(k));
    });
  }

  // Calisthenics Progression Pathway Allowed Pool Filtering
  if (style === "calisthenics") {
    const allowedCalisthenicsNames = new Set(calisthenicsCheckedSkills);
    
    // Include immediate next level skill for checked skills
    Object.values(CALISTHENICS_SKILL_TREES).forEach(tree => {
      tree.forEach((step, idx) => {
        if (calisthenicsCheckedSkills.includes(step.name) && idx + 1 < tree.length) {
          allowedCalisthenicsNames.add(tree[idx + 1].name);
        }
      });
    });

    availableExercises = availableExercises.filter(ex => 
      allowedCalisthenicsNames.has(ex.name) || (ex.equipment || '').toLowerCase().includes('body')
    );
  }

  let targetMuscles = [];
  let title = `${style.toUpperCase()} SESSION`;

  if (split === "upper" || split === "upper_lower_upper") {
    targetMuscles = UPPER_BODY_TARGETS;
    title = "UPPER BODY SESSION";
  } else if (split === "lower" || split === "upper_lower_lower") {
    targetMuscles = LOWER_BODY_TARGETS;
    title = "LOWER BODY SESSION";
  } else if (split === "ppl_push") {
    targetMuscles = ["chest", "upper chest", "lower chest", "pectorals", "shoulders", "front delts", "side delts", "triceps"];
    title = "PUSH SESSION";
  } else if (split === "ppl_pull") {
    targetMuscles = ["lats", "upper back", "rear delts", "traps", "biceps", "brachialis", "forearms"];
    title = "PULL SESSION";
  } else if (split === "ppl_legs") {
    targetMuscles = ["quads", "hamstrings", "glutes", "calves", "abs", "core"];
    title = "LEGS SESSION";
  }

  let pool = availableExercises;
  if (targetMuscles.length > 0) {
    pool = availableExercises.filter(ex => 
      targetMuscles.includes((ex.target || '').toLowerCase().trim()) ||
      (ex.muscle_groups && ex.muscle_groups.primary.some(p => targetMuscles.includes(p.toLowerCase().trim())))
    );
  }

  if (pool.length < exerciseCount) pool = availableExercises;

  let poolCopy = [...pool];
  const selected = [];

  // Antagonistic Superset Generator Branch
  if (userSettings.supersets) {
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

  return { title, exercises: selected, isDeloadWeek };
}

// Movement Audit & Dynamic Mobility Engine
function auditWorkoutBalance(workoutExercises) {
  const counts = { horizontalPush: 0, horizontalPull: 0, verticalPush: 0, verticalPull: 0, kneeDominant: 0, hipDominant: 0 };
  workoutExercises.forEach(ex => {
    const pattern = (ex.movement_pattern || '').toLowerCase();
    const target = (ex.target || ex.muscle_group || '').toLowerCase();

    if (MOVEMENT_PATTERNS.HORIZONTAL_PUSH.includes(pattern)) counts.horizontalPush++;
    else if (MOVEMENT_PATTERNS.HORIZONTAL_PULL.includes(pattern)) counts.horizontalPull++;
    else if (MOVEMENT_PATTERNS.VERTICAL_PUSH.includes(pattern)) counts.verticalPush++;
    else if (MOVEMENT_PATTERNS.VERTICAL_PULL.includes(pattern)) counts.verticalPull++;
    else if (MOVEMENT_PATTERNS.KNEE_DOMINANT.includes(pattern)) counts.kneeDominant++;
    else if (MOVEMENT_PATTERNS.HIP_DOMINANT.includes(pattern)) counts.hipDominant++;
  });
  return counts;
}

function renderBalanceBadgesAndAlerts(counts) {
  const container = document.getElementById('balanceAuditContainer');
  if (!container) return;

  const badges = [];
  const hPush = counts.horizontalPush;
  const hPull = counts.horizontalPull;
  if (hPush > 0 || hPull > 0) {
    if (Math.abs(hPush - hPull) <= 1) badges.push({ text: `Horizontal Push/Pull Balanced (${hPush}:${hPull})`, type: 'success' });
  }

  container.innerHTML = `
    <div class="balance-audit-card">
      <div class="balance-header"><span class="balance-title">⚖️ Active Movement Pattern Balance</span></div>
      <div class="balance-badges">
        ${badges.map(b => `<span class="badge-balance badge-balance-${b.type}">✓ ${b.text}</span>`).join('')}
      </div>
    </div>
  `;
}

function generateTargetedMobility(workoutExercises) {
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

  const activeInj = injuryDataset[userSettings.selectedInjury];
  if (activeInj && activeInj.prehab_drills && activeInj.prehab_drills.length > 0) {
    warmups.push(...activeInj.prehab_drills);
  }

  targetMuscles.forEach(m => {
    if (DYNAMIC_WARMUP_LIBRARY[m]) warmups.push(...DYNAMIC_WARMUP_LIBRARY[m]);
    if (COOL_DOWN_STRETCH_LIBRARY[m]) cooldowns.push(...COOL_DOWN_STRETCH_LIBRARY[m]);
  });

  return { warmups, cooldowns };
}

function renderTargetedMobilityLists(mobility, prefix = '') {
  const warmupContainer = document.getElementById(prefix ? `${prefix}DynamicWarmupList` : 'dynamicWarmupList');
  const cooldownContainer = document.getElementById(prefix ? `${prefix}CooldownStretchList` : 'cooldownStretchList');
  const warmupBadge = document.getElementById(prefix ? `${prefix}WarmupCountBadge` : 'warmupCountBadge');
  const cooldownBadge = document.getElementById(prefix ? `${prefix}CooldownCountBadge` : 'cooldownCountBadge');

  if (warmupBadge) warmupBadge.textContent = `${mobility.warmups.length} Drills`;
  if (cooldownBadge) cooldownBadge.textContent = `${mobility.cooldowns.length} Stretches`;

  if (warmupContainer) {
    warmupContainer.innerHTML = mobility.warmups.map(w => `
      <div class="mobility-item">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="mobility-title">${w.isPrehab ? '<span class="prehab-tag">🩹 PREHAB</span> ' : ''}${w.name}</span>
          <span class="mobility-duration">${w.duration}</span>
        </div>
        <div class="mobility-desc">${w.desc}</div>
      </div>
    `).join('');
  }

  if (cooldownContainer) {
    cooldownContainer.innerHTML = mobility.cooldowns.map(c => `
      <div class="mobility-item">
        <div style="display:flex; justify-content:space-between;"><span class="mobility-title">${c.name}</span><span class="mobility-duration">${c.duration}</span></div>
        <div class="mobility-desc">${c.desc}</div>
      </div>
    `).join('');
  }
}

function renderCalisthenicsSkillTree() {
  const container = document.getElementById("calisthenicsSkillTreeContainer");
  if (!container) return;

  if (userSettings.workoutStyle !== "calisthenics") {
    container.classList.add("hidden");
    return;
  }

  container.classList.remove("hidden");
  container.innerHTML = `
    <div class="skill-tree-card">
      <h4 style="color: var(--accent-gold); font-size: 0.9rem; margin-bottom: 6px;">🤸 CALISTHENICS SKILL PROGRESSION PATHWAYS</h4>
      <div class="skill-section">
        <strong style="color: #c084fc; font-size: 0.8rem;">PUSH PATHWAY:</strong>
        ${CALISTHENICS_SKILL_TREES.push.map(s => `
          <div class="skill-step ${calisthenicsCheckedSkills.includes(s.name) ? 'active-step' : ''}">
            <span>L${s.level}: ${s.name}</span>
            <span style="color: #cbd5e1;">Target: ${s.reps}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderCalisthenicsPathwaysTab() {
  const container = document.getElementById("calisthenics-pathways-container");
  if (!container) return;

  const renderSection = (title, skills) => `
    <div class="metal-subcard margin-top">
      <h4 style="color: var(--accent-gold); font-size: 0.95rem; margin-bottom: 8px;">${title}</h4>
      ${skills.map(s => `
        <div class="skill-step">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; width: 100%;">
            <input type="checkbox" ${calisthenicsCheckedSkills.includes(s.name) ? 'checked' : ''} onchange="toggleCalisthenicsSkill('${s.name.replace(/'/g, "\\'")}')">
            <span><strong>L${s.level}: ${s.name}</strong> (${s.reps})</span>
          </label>
        </div>
      `).join("")}
    </div>
  `;

  container.innerHTML = `
    ${renderSection("💪 PUSH PATHWAY", CALISTHENICS_SKILL_TREES.push)}
    ${renderSection("🧗 PULL PATHWAY", CALISTHENICS_SKILL_TREES.pull)}
    ${renderSection("🦵 LEGS PATHWAY", CALISTHENICS_SKILL_TREES.legs)}
  `;
}

window.toggleCalisthenicsSkill = function(skillName) {
  if (calisthenicsCheckedSkills.includes(skillName)) {
    calisthenicsCheckedSkills = calisthenicsCheckedSkills.filter(s => s !== skillName);
  } else {
    calisthenicsCheckedSkills.push(skillName);
  }
  localStorage.setItem("gymbro_calisthenics_skills", JSON.stringify(calisthenicsCheckedSkills));
  saveUserDataToCloud();
  renderCalisthenicsPathwaysTab();
};

// Event Listeners Initialization
function initEventListeners() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  const openCustomBtn = document.getElementById("open-custom-ex-btn");
  const closeCustomBtn = document.getElementById("close-custom-ex-btn");
  const customModal = document.getElementById("custom-ex-modal");
  const customForm = document.getElementById("custom-ex-form");

  if (openCustomBtn) openCustomBtn.addEventListener("click", () => customModal.classList.remove("hidden"));
  if (closeCustomBtn) closeCustomBtn.addEventListener("click", () => customModal.classList.add("hidden"));

  if (customForm) {
    customForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const newEx = {
        id: `custom_${Date.now()}`,
        name: document.getElementById("custom-ex-name").value.trim(),
        target: document.getElementById("custom-ex-target").value,
        equipment: document.getElementById("custom-ex-equipment").value,
        isCustom: true
      };

      customExercises.push(newEx);
      localStorage.setItem("gymbro_custom_exercises", JSON.stringify(customExercises));
      mergeCustomExercises();
      saveUserDataToCloud();

      customForm.reset();
      customModal.classList.add("hidden");
      alert("Custom exercise created successfully!");
    });
  }

  const authForm = document.getElementById("auth-form");
  const toggleAuthBtn = document.getElementById("toggle-auth-mode-btn");

  if (authForm) {
    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("auth-email").value.trim();
      const password = document.getElementById("auth-password").value.trim();
      const errorMsg = document.getElementById("auth-error-msg");
      if (errorMsg) errorMsg.innerText = "";

      try {
        if (isSignUpMode) {
          await auth.createUserWithEmailAndPassword(email, password);
        } else {
          await auth.signInWithEmailAndPassword(email, password);
        }
      } catch (err) {
        if (errorMsg) errorMsg.innerText = err.message;
      }
    });
  }

  if (toggleAuthBtn) {
    toggleAuthBtn.addEventListener("click", () => {
      isSignUpMode = !isSignUpMode;
      document.getElementById("auth-title").innerText = isSignUpMode ? "CREATE ACCOUNT" : "IRON BRO LOGIN";
      document.getElementById("auth-submit-btn").innerText = isSignUpMode ? "SIGN UP" : "LOG IN";
      toggleAuthBtn.innerText = isSignUpMode ? "ALREADY HAVE AN ACCOUNT? LOG IN" : "NEED AN ACCOUNT? SIGN UP";
    });
  }

  document.getElementById("open-settings-btn").addEventListener("click", () => {
    document.getElementById("settings-modal").classList.remove("hidden");
  });
  document.getElementById("close-settings-btn").addEventListener("click", () => {
    document.getElementById("settings-modal").classList.add("hidden");
  });
  document.getElementById("save-settings-btn").addEventListener("click", saveSettingsUI);

  const exportBtn = document.getElementById("export-csv-btn");
  if (exportBtn) exportBtn.addEventListener("click", exportHistoryToCSV);

  document.getElementById("close-picker-btn").addEventListener("click", () => {
    document.getElementById("exercise-picker-modal").classList.add("hidden");
  });

  document.getElementById("generate-workout-btn").addEventListener("click", () => {
    const session = generateWorkoutSession();
    renderGeneratedWorkout(session);
  });

  document.getElementById("start-workout-btn").addEventListener("click", () => {
    const sessionData = window.currentGeneratedSession;
    if (sessionData) startActiveWorkout(sessionData);
  });

  document.getElementById("resume-workout-btn").addEventListener("click", () => {
    document.getElementById("active-workout-modal").classList.remove("hidden");
  });
  document.getElementById("minimize-workout-btn").addEventListener("click", () => {
    document.getElementById("active-workout-modal").classList.add("hidden");
  });
  document.getElementById("finish-workout-btn").addEventListener("click", finishActiveWorkout);

  document.getElementById("create-plan-btn").addEventListener("click", buildMultiMonthPlan);
  document.getElementById("build-custom-pb-btn").addEventListener("click", buildCustomProgramBuilderPlan);

  document.getElementById("reset-plan-btn").addEventListener("click", () => {
    if (confirm("Reset current program plan?")) {
      activePlan = null;
      localStorage.removeItem(getPlanStorageKey());
      saveUserDataToCloud();
      renderPlanUI();
    }
  });
}

function initSettingsUI() {
  document.getElementById("setting-profile").value = userSettings.workoutStyle || "standard";
  document.getElementById("setting-injury").value = userSettings.selectedInjury || "none";
  document.getElementById("setting-progression").value = userSettings.progressionScheme || "linear";
  document.getElementById("setting-split").value = userSettings.split;
  document.getElementById("setting-duration").value = userSettings.duration;
  document.getElementById("setting-rest-time").value = userSettings.restTime || 60;
  document.getElementById("setting-supersets").checked = userSettings.supersets;

  const maxes = userSettings.maxLifts || DEFAULT_MAX_LIFTS;
  if (document.getElementById("maxBench")) document.getElementById("maxBench").value = maxes.benchPress || 185;
  if (document.getElementById("maxSquat")) document.getElementById("maxSquat").value = maxes.squat || 225;
  if (document.getElementById("maxDeadlift")) document.getElementById("maxDeadlift").value = maxes.deadlift || 275;
  if (document.getElementById("maxOHP")) document.getElementById("maxOHP").value = maxes.overheadPress || 115;

  const eqCheckboxes = document.querySelectorAll("#equipment-toggles input");
  eqCheckboxes.forEach(cb => {
    cb.checked = userSettings.equipment.includes(cb.value);
  });

  onWorkoutStyleChangeUI(userSettings.workoutStyle);
}

function saveSettingsUI() {
  userSettings.workoutStyle = document.getElementById("setting-profile").value;
  userSettings.selectedInjury = document.getElementById("setting-injury").value;
  userSettings.progressionScheme = document.getElementById("setting-progression").value;
  userSettings.split = document.getElementById("setting-split").value;
  userSettings.duration = parseInt(document.getElementById("setting-duration").value, 10);
  userSettings.restTime = parseInt(document.getElementById("setting-rest-time").value, 10);
  userSettings.supersets = document.getElementById("setting-supersets").checked;

  userSettings.maxLifts = {
    benchPress: parseFloat(document.getElementById("maxBench").value) || 185,
    squat: parseFloat(document.getElementById("maxSquat").value) || 225,
    deadlift: parseFloat(document.getElementById("maxDeadlift").value) || 275,
    overheadPress: parseFloat(document.getElementById("maxOHP").value) || 115
  };

  const selectedEquipment = [];
  document.querySelectorAll("#equipment-toggles input:checked").forEach(cb => {
    selectedEquipment.push(cb.value);
  });
  userSettings.equipment = selectedEquipment;

  localStorage.setItem("gymbro_settings", JSON.stringify(userSettings));
  applyProfileThemeAndRules();
  saveUserDataToCloud();
  renderPlanUI();
  document.getElementById("settings-modal").classList.add("hidden");
  alert("Settings saved!");
}

function exportHistoryToCSV() {
  if (!workoutHistory || workoutHistory.length === 0) {
    alert("No logged workout history available to export.");
    return;
  }
  let csvContent = "Date,Workout Title,Exercises Completed,Total Volume (lbs)\n";
  workoutHistory.forEach(row => {
    csvContent += `"${row.date || ''}","${(row.title || '').replace(/"/g, '""')}",${row.exerciseCount || 0},${row.totalVolume || 0}\n`;
  });
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `omnipath_progress_log_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderGeneratedWorkout(session) {
  window.currentGeneratedSession = session;
  document.getElementById("workout-title").innerText = session.title;
  document.getElementById("workout-meta").innerText = `${userSettings.duration} Mins | Style: ${(userSettings.workoutStyle || 'STANDARD').toUpperCase()} | Progression: ${userSettings.progressionScheme.toUpperCase()}${userSettings.selectedInjury !== "none" ? ` | 🩹 INJURY FILTER: ${userSettings.selectedInjury.replace(/_/g, ' ').toUpperCase()}` : ""}`;

  const exDiv = document.getElementById("exercise-list");
  exDiv.innerHTML = session.exercises.map(ex => `
    <div class="exercise-card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h5>${ex.name}</h5>
        ${ex.supersetGroup ? `<span class="tag" style="color:var(--accent-gold); border-color:var(--accent-gold);">${ex.supersetGroup}</span>` : ''}
      </div>
      <div class="exercise-tags">
        <span class="tag">Target: ${ex.target}</span>
        <span class="tag">Equip: ${ex.equipment}</span>
      </div>
    </div>
  `).join("");

  renderCalisthenicsSkillTree();
  const balanceCounts = auditWorkoutBalance(session.exercises);
  renderBalanceBadgesAndAlerts(balanceCounts);
  const mobility = generateTargetedMobility(session.exercises);
  renderTargetedMobilityLists(mobility);

  document.getElementById("generated-workout-view").classList.remove("hidden");
}

function buildCustomProgramBuilderPlan() {
  const weeksCount = parseInt(document.getElementById("pb-weeks").value, 10);
  const progRate = parseFloat(document.getElementById("pb-progression-rate").value);
  const exCount = parseInt(document.getElementById("pb-exercises-count").value, 10);
  const restSecs = parseInt(document.getElementById("pb-rest").value, 10);
  const split = document.getElementById("pb-split").value;

  const pbEquip = [];
  document.querySelectorAll("#pb-equipment-toggles input:checked").forEach(cb => pbEquip.push(cb.value));

  let dayTemplates = [];
  if (split === "upper_lower") {
    dayTemplates = [
      { id: "d1", title: "Upper Body A", type: "upper" },
      { id: "d2", title: "Lower Body A", type: "lower" },
      { id: "d3", title: "Rest Day", type: "rest" },
      { id: "d4", title: "Upper Body B", type: "upper" },
      { id: "d5", title: "Lower Body B", type: "lower" },
      { id: "d6", title: "Rest Day", type: "rest" },
      { id: "d7", title: "Rest Day", type: "rest" }
    ];
  } else if (split === "ppl") {
    dayTemplates = [
      { id: "d1", title: "Push Workout", type: "ppl_push" },
      { id: "d2", title: "Pull Workout", type: "ppl_pull" },
      { id: "d3", title: "Legs Workout", type: "ppl_legs" },
      { id: "d4", title: "Rest Day", type: "rest" }
    ];
  } else {
    dayTemplates = [
      { id: "d1", title: "Full Body A", type: "full_body" },
      { id: "d2", title: "Rest Day", type: "rest" },
      { id: "d3", title: "Full Body B", type: "full_body" },
      { id: "d4", title: "Rest Day", type: "rest" }
    ];
  }

  const weeks = [];
  for (let w = 1; w <= weeksCount; w++) {
    const isDeload = (w % 4 === 0);
    const days = dayTemplates.map((template, dIdx) => {
      const slots = [];
      if (template.type !== "rest") {
        for (let s = 0; s < exCount; s++) {
          slots.push({ slotIdx: s, exercise: null });
        }
      }
      return {
        id: `w${w}_d${dIdx + 1}`,
        dayNum: dIdx + 1,
        title: template.title,
        type: template.type,
        isDeload,
        completed: false,
        slots
      };
    });
    weeks.push({ weekNum: w, isDeload, days });
  }

  activePlan = {
    isProgramBuilder: true,
    weeksCount,
    progressionRate: progRate,
    exCount,
    restSecs,
    equipment: pbEquip,
    weeks,
    createdAt: new Date().toISOString()
  };

  localStorage.setItem(getPlanStorageKey(), JSON.stringify(activePlan));
  saveUserDataToCloud();
  renderPlanUI();
}

function buildMultiMonthPlan() {
  const months = parseInt(document.getElementById("plan-duration").value, 10);
  const totalWeeks = months * 4;

  let schedulePattern = [
    { name: "Session A", type: "upper_lower_upper" },
    { name: "Session B", type: "upper_lower_lower" },
    { name: "Rest Day", type: "rest" },
    { name: "Session C", type: "upper_lower_upper" },
    { name: "Session D", type: "upper_lower_lower" },
    { name: "Rest Day", type: "rest" },
    { name: "Rest Day", type: "rest" }
  ];

  const weeks = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const isDeload = (w % 4 === 0);
    const days = schedulePattern.map((day, idx) => ({
      id: `w${w}_d${idx + 1}`,
      dayNum: idx + 1,
      title: `${day.name}${isDeload ? ' (Deload)' : ''}`,
      type: day.type,
      isDeload,
      completed: false
    }));
    weeks.push({ weekNum: w, isDeload, days });
  }

  activePlan = { months, totalWeeks, split: userSettings.split, weeks, createdAt: new Date().toISOString() };
  localStorage.setItem(getPlanStorageKey(), JSON.stringify(activePlan));
  saveUserDataToCloud();
  renderPlanUI();
}

function renderPlanUI() {
  const storageKey = getPlanStorageKey();
  activePlan = JSON.parse(localStorage.getItem(storageKey)) || null;

  const container = document.getElementById("active-plan-container");
  if (!activePlan) { container.classList.add("hidden"); return; }

  container.classList.remove("hidden");
  const style = userSettings.workoutStyle || "standard";
  document.getElementById("plan-title").innerText = `${style.toUpperCase()} - CUSTOM PROGRAM PLAN (${activePlan.weeksCount || activePlan.totalWeeks} WEEKS)`;

  let totalWorkouts = 0;
  let completedWorkouts = 0;

  const accordion = document.getElementById("plan-weeks-accordion");
  accordion.innerHTML = activePlan.weeks.map(week => {
    const weekDaysHtml = week.days.map(day => {
      if (day.type !== "rest") totalWorkouts++;
      if (day.completed) completedWorkouts++;

      let slotsHtml = "";
      if (activePlan.isProgramBuilder && day.slots) {
        slotsHtml = `
          <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
            ${day.slots.map((s, idx) => `
              <button class="pb-slot-btn ${s.exercise ? 'filled' : ''}" onclick="openExercisePickerModal('${week.weekNum}', '${day.id}',${idx})">
                ${s.exercise ? `✓ ${s.exercise.name} (${s.exercise.equipment})` : `+ Slot ${idx + 1}: Select Exercise...`}
              </button>
            `).join("")}
          </div>
        `;
      }

      return `
        <div class="day-row ${day.completed ? 'completed' : ''}" style="flex-direction: column; align-items: stretch;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>Day ${day.dayNum}: ${day.title} ${day.isDeload ? '<span class="badge-deload">DELOAD</span>' : ''}</span>
            ${day.type !== "rest" ? `
              <button class="metal-btn small-btn ${day.completed ? 'danger-btn' : 'primary-btn'}" onclick="togglePlanDay('${week.weekNum}', '${day.id}')">
                ${day.completed ? 'UNDO' : 'START / LOG'}
              </button>
            ` : '<span class="tag">REST</span>'}
          </div>
          ${slotsHtml}
        </div>
      `;
    }).join("");

    return `
      <div class="week-card ${week.isDeload ? 'border-deload' : ''}">
        <div class="week-header">WEEK ${week.weekNum} ${week.isDeload ? '🧊 (DELOAD WEEK)' : ''}</div>
        <div class="week-body">${weekDaysHtml}</div>
      </div>
    `;
  }).join("");

  const percent = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;
  document.getElementById("plan-progress-fill").style.width = `${percent}%`;
  document.getElementById("plan-stats-text").innerText = `${completedWorkouts} of ${totalWorkouts} Workouts Completed (${percent}%)`;
}

function openExercisePickerModal(weekNum, dayId, slotIdx) {
  activePickerTarget = { weekNum, dayId, slotIdx };
  document.getElementById("picker-slot-subtitle").innerText = `Week ${weekNum} - Day Slot ${slotIdx + 1}`;
  
  const pickerWarn = document.getElementById("injury-picker-warning");
  if (userSettings.selectedInjury !== "none") {
    pickerWarn.classList.remove("hidden");
  } else {
    pickerWarn.classList.add("hidden");
  }

  document.getElementById("exercise-search-input").value = "";
  filterExercisePickerResults();
  document.getElementById("exercise-picker-modal").classList.remove("hidden");
}

function filterExercisePickerResults() {
  const query = (document.getElementById("exercise-search-input").value || "").toLowerCase().trim();
  const allowedEquip = activePlan && activePlan.equipment ? activePlan.equipment : userSettings.equipment;

  let pool = exerciseDataset.filter(ex => {
    const matchesEquip = allowedEquip.includes((ex.equipment || '').toLowerCase().trim());
    const contraindicated = isExerciseContraindicated(ex);
    return matchesEquip && !contraindicated;
  });

  if (query) {
    pool = pool.filter(ex => 
      (ex.name || '').toLowerCase().includes(query) ||
      (ex.target || '').toLowerCase().includes(query) ||
      (ex.movement_pattern || '').toLowerCase().includes(query)
    );
  }

  const resultsDiv = document.getElementById("picker-results-list");
  if (pool.length === 0) {
    resultsDiv.innerHTML = `<p style="font-size:0.8rem; color:#94a3b8;">No matching exercises found.</p>`;
    return;
  }

  resultsDiv.innerHTML = pool.slice(0, 30).map(ex => `
    <div class="picker-item-card" onclick="selectPickerExercise('${ex.id || ex.name.replace(/'/g, "\\'")}')">
      <div>
        <div class="picker-item-title">${ex.name}</div>
        <div class="picker-item-meta">Target: ${ex.target || 'General'} | Equip: ${ex.equipment}</div>
      </div>
      <button class="metal-btn small-btn primary-btn">+ ASSIGN</button>
    </div>
  `).join("");
}

function selectPickerExercise(exId) {
  if (!activePickerTarget || !activePlan) return;
  const ex = exerciseDataset.find(e => (e.id || e.name) === exId);
  if (!ex) return;

  const week = activePlan.weeks.find(w => w.weekNum == activePickerTarget.weekNum);
  if (!week) return;
  const day = week.days.find(d => d.id === activePickerTarget.dayId);
  if (!day || !day.slots) return;

  day.slots[activePickerTarget.slotIdx].exercise = {
    id: ex.id || ex.name,
    name: ex.name,
    target: ex.target,
    equipment: ex.equipment
  };

  localStorage.setItem(getPlanStorageKey(), JSON.stringify(activePlan));
  saveUserDataToCloud();
  renderPlanUI();
  document.getElementById("exercise-picker-modal").classList.add("hidden");
}

window.togglePlanDay = function(weekNum, dayId) {
  if (!activePlan) return;
  const week = activePlan.weeks.find(w => w.weekNum == weekNum);
  if (!week) return;
  const day = week.days.find(d => d.id === dayId);
  if (!day) return;

  if (day.completed) {
    day.completed = false;
  } else {
    let session;
    if (activePlan.isProgramBuilder && day.slots && day.slots.some(s => s.exercise)) {
      const selectedExs = day.slots.filter(s => s.exercise).map(s => s.exercise);
      session = {
        title: `Week ${weekNum} - ${day.title}`,
        exercises: selectedExs,
        weekNum,
        planDayRef: dayId
      };
    } else {
      session = generateWorkoutSession(day.type, day.isDeload);
      session.title = `Week ${weekNum} - ${day.title}`;
      session.weekNum = weekNum;
      session.planDayRef = dayId;
    }
    startActiveWorkout(session);
    return;
  }

  localStorage.setItem(getPlanStorageKey(), JSON.stringify(activePlan));
  saveUserDataToCloud();
  renderPlanUI();
};

function startActiveWorkout(session) {
  const currentWeek = session.weekNum || 1;
  const scheme = userSettings.progressionScheme || "linear";
  const rate = activePlan && activePlan.progressionRate ? activePlan.progressionRate / 100 : 0;

  activeWorkout = {
    ...session,
    startTime: new Date().toISOString(),
    logs: session.exercises.map(ex => {
      const exKey = ex.id || ex.name;
      const historyRec = exerciseHistory[exKey];

      const sets = [];
      for (let i = 0; i < 3; i++) {
        const target = calculateProgressionSetTargets(ex, scheme, currentWeek, i);
        let finalWeight = target.weight;
        if (rate > 0 && currentWeek > 1) {
          finalWeight = roundTo5(finalWeight * Math.pow(1 + rate, currentWeek - 1));
        }

        if (historyRec && historyRec.lastWeight) {
          finalWeight = historyRec.lastWeight;
        }

        sets.push({
          reps: target.reps,
          weight: target.isBodyweight ? 0 : finalWeight,
          completed: false,
          label: target.label
        });
      }
      return {
        id: exKey,
        name: ex.name,
        target: ex.target,
        sets
      };
    })
  };

  localStorage.setItem("gymbro_active_session", JSON.stringify(activeWorkout));
  checkActiveSession();
  document.getElementById("active-workout-modal").classList.remove("hidden");
}

function checkActiveSession() {
  const stored = localStorage.getItem("gymbro_active_session");
  const banner = document.getElementById("active-session-banner");
  if (stored) {
    activeWorkout = JSON.parse(stored);
    banner.classList.remove("hidden");
    renderActiveWorkoutModal();
  } else {
    banner.classList.add("hidden");
  }
}

function renderActiveWorkoutModal() {
  if (!activeWorkout) return;
  document.getElementById("active-workout-name").innerText = activeWorkout.title;

  // Render Mobility Lists in Active Workout Modal
  const mobility = generateTargetedMobility(activeWorkout.exercises || activeWorkout.logs);
  renderTargetedMobilityLists(mobility, 'active');

  const container = document.getElementById("active-exercise-container");
  container.innerHTML = activeWorkout.logs.map((ex, exIdx) => {
    const exKey = ex.id || ex.name;
    const historyRec = exerciseHistory[exKey];
    let overloadBadge = "";

    if (historyRec && historyRec.lastReps >= 12) {
      overloadBadge = `<span class="badge-suggested-weight">🚀 +5 lbs Suggested</span>`;
    }

    return `
      <div class="exercise-card margin-top">
        <div class="exercise-card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h5>${ex.name}</h5>
          ${overloadBadge}
        </div>
        ${historyRec ? `<div style="margin-top:4px;"><span class="last-time-badge">LAST TIME: ${historyRec.lastWeight} lbs × ${historyRec.lastReps} reps</span></div>` : ''}
        <div class="sets-table margin-top">
          ${ex.sets.map((set, setIdx) => `
            <div class="set-row ${set.completed ? 'completed-set' : ''}" style="display:flex; justify-content:space-between; align-items:center; padding: 4px 0;">
              <span>Set ${setIdx + 1} <small class="set-loading-badge">${set.label || ''}</small></span>
              <div>
                <input type="number" value="${set.weight}" style="width: 65px;" class="metal-input" onchange="updateSetData(${exIdx},${setIdx}, 'weight', this.value)"> lbs
                <input type="number" value="${set.reps}" style="width: 55px; margin-left:4px;" class="metal-input" onchange="updateSetData(${exIdx},${setIdx}, 'reps', this.value)"> reps
              </div>
              <label class="set-check-label" style="font-size: 12px; cursor: pointer;">
                <input type="checkbox" ${set.completed ? 'checked' : ''} onchange="toggleSetComplete(${exIdx},${setIdx}, this.checked)"> DONE
              </label>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

window.updateSetData = function(exIdx, setIdx, field, val) {
  if (!activeWorkout) return;
  activeWorkout.logs[exIdx].sets[setIdx][field] = parseFloat(val) || 0;
  localStorage.setItem("gymbro_active_session", JSON.stringify(activeWorkout));
};

window.toggleSetComplete = function(exIdx, setIdx, isChecked) {
  if (!activeWorkout) return;
  activeWorkout.logs[exIdx].sets[setIdx].completed = isChecked;
  localStorage.setItem("gymbro_active_session", JSON.stringify(activeWorkout));
  renderActiveWorkoutModal();

  if (isChecked) {
    startRestTimer(parseInt(userSettings.restTime || 60, 10));
  }
};

function finishActiveWorkout() {
  if (!activeWorkout) return;

  let totalSessionVolume = 0;
  let totalCompletedSets = 0;

  const exerciseBreakdowns = activeWorkout.logs.map(ex => {
    const exKey = ex.id || ex.name;
    let exVolume = 0;
    let maxWeight = 0;
    let maxReps = 0;

    ex.sets.forEach(s => {
      const setVol = (s.weight || 0) * (s.reps || 0);
      exVolume += setVol;
      totalSessionVolume += setVol;
      totalCompletedSets++;
      if (s.weight >= maxWeight) { maxWeight = s.weight; maxReps = s.reps; }
    });

    exerciseHistory[exKey] = {
      lastWeight: maxWeight || ex.sets[0]?.weight || 0,
      lastReps: maxReps || ex.sets[0]?.reps || 0,
      sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps })),
      lastUpdated: new Date().toLocaleDateString()
    };

    return { name: ex.name, sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps })), exerciseVolume: exVolume };
  });

  localStorage.setItem("gymbro_exercise_history", JSON.stringify(exerciseHistory));

  if (activeWorkout.planDayRef && activePlan) {
    activePlan.weeks.forEach(w => {
      w.days.forEach(d => { if (d.id === activeWorkout.planDayRef) d.completed = true; });
    });
    localStorage.setItem(getPlanStorageKey(), JSON.stringify(activePlan));
    renderPlanUI();
  }

  const historyEntry = {
    id: `log_${Date.now()}`,
    title: activeWorkout.title,
    date: new Date().toLocaleDateString(),
    exerciseCount: activeWorkout.logs.length,
    totalCompletedSets,
    totalVolume: totalSessionVolume,
    exercises: exerciseBreakdowns
  };

  workoutHistory.unshift(historyEntry);
  localStorage.setItem("gymbro_history", JSON.stringify(workoutHistory));
  localStorage.removeItem("gymbro_active_session");

  saveUserDataToCloud();

  activeWorkout = null;
  document.getElementById("active-workout-modal").classList.add("hidden");
  document.getElementById("sticky-timer-bar").classList.add("hidden");
  clearInterval(timerInterval);

  checkActiveSession();
  renderHistoryUI();
  alert(`Workout Logged! Total Volume Lifted: ${totalSessionVolume.toLocaleString()} lbs`);
}

function renderHistoryUI() {
  const container = document.getElementById("history-list");
  if (!workoutHistory || workoutHistory.length === 0) {
    container.innerHTML = '<p class="empty-msg">No completed workouts logged yet.</p>';
    return;
  }

  container.innerHTML = workoutHistory.map(item => `
    <div class="history-card" style="background: #0f172a; border-radius: 8px; padding: 12px; margin-bottom: 10px; border-left: 4px solid var(--accent-gold);">
      <div class="history-card-header" onclick="toggleHistoryCardDetails('${item.id}')" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
        <div>
          <div class="history-title"><strong style="color: #e2e8f0;">${item.title}</strong></div>
          <div class="history-meta" style="color: #cbd5e1; font-size: 12px;">${item.date} • ${item.exerciseCount || 0} Exercises • ${item.totalCompletedSets || 0} Sets</div>
        </div>
        <div class="history-volume-badge" style="background: rgba(255, 215, 0, 0.15); color: var(--accent-gold); padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 13px;">
          ${(item.totalVolume || 0).toLocaleString()} lbs
        </div>
      </div>
      <div id="card_details_${item.id}" class="history-card-body hidden" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
        ${item.exercises ? item.exercises.map(ex => `
          <div class="history-exercise-block" style="margin-bottom: 6px;">
            <div class="history-exercise-name" style="color: var(--accent-gold); font-size: 13px; font-weight: 600;">${ex.name}</div>
            <div class="history-sets-summary" style="color: #94a3b8; font-size: 11px;">
              ${ex.sets ? ex.sets.map((s, idx) => `Set ${idx + 1}: ${s.weight} lbs × ${s.reps} reps`).join(" | ") : ""}
            </div>
          </div>
        `).join("") : ''}
      </div>
    </div>
  `).join("");
}

window.toggleHistoryCardDetails = function(cardId) {
  const el = document.getElementById(`card_details_${cardId}`);
  if (el) el.classList.toggle("hidden");
};
