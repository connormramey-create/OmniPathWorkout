import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "./config/firebase";

// Helper for safe localStorage parsing
function getSafeLocalStorage(key, fallbackValue) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallbackValue;
  } catch (error) {
    console.warn(`Failed to parse localStorage key "${key}". Resetting to default.`, error);
    localStorage.removeItem(key);
    return fallbackValue;
  }
}

// Master Muscle & Movement Maps
const UPPER_BODY_TARGETS = [
  "chest", "upper chest", "lower chest", "pectorals", "lats", "upper back", 
  "shoulders", "front delts", "side delts", "rear delts", "traps", "biceps", 
  "brachialis", "triceps", "forearms"
];
const LOWER_BODY_TARGETS = [
  "quads", "hamstrings", "glutes", "glute medius", "calves", "soleus", 
  "gastrocnemius", "adductors", "shin", "tibialis anterior", "abs", "obliques", "core", "lower back"
];
const POWERLIFTER_COMPOUNDS = [
  "squat", "bench press", "deadlift", "overhead press", "barbell shoulder press", 
  "sumo deadlift", "front squat", "incline bench press"
];

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
  HORIZONTAL_PUSH: ["horizontal push"],
  HORIZONTAL_PULL: ["horizontal pull"],
  VERTICAL_PUSH: ["vertical push"],
  VERTICAL_PULL: ["vertical pull"],
  KNEE_DOMINANT: ["squat", "knee extension"],
  HIP_DOMINANT: ["hinge", "hip extension", "knee flexion"]
};

// Calisthenics Skill Progression Trees
const CALISTHENICS_SKILL_TREES = {
  push: [
    { level: 1, name: "Push-Up", target: "chest", equipment: "body weight", reps: "8-12 reps" },
    { level: 2, name: "Diamond Push-Up", target: "triceps", equipment: "body weight", reps: "8-12 reps" },
    { level: 3, name: "Pike Push-Up", target: "shoulders", equipment: "body weight", reps: "6-10 reps" },
    { level: 4, name: "Elevated Pike Push-Up", target: "shoulders", equipment: "body weight", reps: "5-8 reps" },
    { level: 5, name: "Handstand Push-Up (Wall Supported)", target: "shoulders", equipment: "body weight", reps: "3-5 reps" }
  ],
  pull: [
    { level: 1, name: "Australian Inverted Row", target: "upper back", equipment: "body weight", reps: "8-12 reps" },
    { level: 2, name: "Chin-Up", target: "biceps", equipment: "body weight", reps: "6-10 reps" },
    { level: 3, name: "Pull-Up", target: "lats", equipment: "body weight", reps: "5-8 reps" },
    { level: 4, name: "Archer Pull-Up", target: "lats", equipment: "body weight", reps: "4-6 reps" },
    { level: 5, name: "Muscle-Up", target: "lats", equipment: "body weight", reps: "2-4 reps" }
  ],
  legs: [
    { level: 1, name: "Air Squat", target: "quads", equipment: "body weight", reps: "15-20 reps" },
    { level: 2, name: "Bulgarian Split Squat", target: "quads", equipment: "body weight", reps: "8-12 reps" },
    { level: 3, name: "Shrimp Squat", target: "quads", equipment: "body weight", reps: "5-8 reps" },
    { level: 4, name: "Pistol Squat", target: "quads", equipment: "body weight", reps: "3-6 reps" }
  ]
};

// Dynamic Mobility Libraries
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

const DEFAULT_MAX_LIFTS = { benchPress: 185, squat: 225, deadlift: 275, overheadPress: 115 };
const DEFAULT_SETTINGS = {
  profile: "standard",
  progressionScheme: "linear",
  split: "upper_lower",
  duration: 45,
  restTime: 60,
  equipment: ["barbell", "dumbbell", "cable", "leverage machine", "smith machine", "body weight", "kettlebell", "band", "other"],
  supersets: false,
  maxLifts: DEFAULT_MAX_LIFTS,
  calisthenicsUnlocked: { push: [1], pull: [1], legs: [1] }
};

const DEFAULT_EXERCISES = [
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

export default function App() {
  // State variables with safe localStorage retrieval
  const [userSettings, setUserSettings] = useState(() => getSafeLocalStorage("gymbro_settings", DEFAULT_SETTINGS));
  const [workoutHistory, setWorkoutHistory] = useState(() => getSafeLocalStorage("gymbro_history", []));
  const [exerciseHistory, setExerciseHistory] = useState(() => getSafeLocalStorage("gymbro_exercise_history", {}));
  const [customExercises, setCustomExercises] = useState(() => getSafeLocalStorage("gymbro_custom_exercises", []));
  const [activePlan, setActivePlan] = useState(() => getSafeLocalStorage(`gymbro_active_plan_${userSettings.profile || "standard"}`, null));
  const [activeWorkout, setActiveWorkout] = useState(() => getSafeLocalStorage("gymbro_active_session", null));
  
  const [activeTab, setActiveTab] = useState("generator");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showActiveModal, setShowActiveModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [generatedSession, setGeneratedSession] = useState(null);

  // Timer states
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [showTimerBar, setShowTimerBar] = useState(false);
  const timerRef = useRef(null);

  // Sync settings & active plan key on profile change
  useEffect(() => {
    localStorage.setItem("gymbro_settings", JSON.stringify(userSettings));
    const planKey = `gymbro_active_plan_${userSettings.profile || "standard"}`;
    const loadedPlan = getSafeLocalStorage(planKey, null);
    setActivePlan(loadedPlan);
  }, [userSettings]);

  // Firebase Auth listener
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
        setShowAuthModal(false);
        if (db) {
          db.ref(`users/${user.uid}`).on("value", (snapshot) => {
            const data = snapshot.val();
            if (data) {
              if (data.settings) setUserSettings(data.settings);
              if (data.history) setWorkoutHistory(data.history);
              if (data.exercise_history) setExerciseHistory(data.exercise_history);
              if (data.custom_exercises) setCustomExercises(data.custom_exercises);
            }
          });
        }
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Audio finish sound alert
  const playFinishSound = () => {
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
    } catch (e) {
      console.error(e);
    }
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  };

  // Timer runner effect
  useEffect(() => {
    if (showTimerBar && !isTimerPaused && timerRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            playFinishSound();
            setTimeout(() => setShowTimerBar(false), 4000);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [showTimerBar, isTimerPaused, timerRemaining]);

  const startRestTimer = (secs) => {
    const time = secs || userSettings.restTime || 60;
    setTimerRemaining(time);
    setIsTimerPaused(false);
    setShowTimerBar(true);
  };

  // Get available Calisthenics pool based on unlocked skill checkboxes
  const getCalisthenicsPool = () => {
    const pool = [];
    const unlockedMap = userSettings.calisthenicsUnlocked || { push: [1], pull: [1], legs: [1] };

    Object.keys(CALISTHENICS_SKILL_TREES).forEach((category) => {
      const pathway = CALISTHENICS_SKILL_TREES[category];
      const checkedLevels = unlockedMap[category] || [1];

      const allowedLevels = new Set(checkedLevels);
      checkedLevels.forEach((lvl) => {
        if (lvl < pathway.length) allowedLevels.add(lvl + 1);
      });

      pathway.forEach((item) => {
        if (allowedLevels.has(item.level)) {
          pool.push({
            id: `cali_${category}_l${item.level}`,
            name: item.name,
            target: item.target,
            equipment: "body weight",
            movement_pattern: category === "push" ? "horizontal push" : category === "pull" ? "horizontal pull" : "squat",
            level: item.level,
            category
          });
        }
      });
    });
    return pool;
  };

  // Generate Workout Session
  const generateWorkout = (splitOverride = null, isDeloadWeek = false) => {
    const profile = userSettings.profile || "standard";
    const split = splitOverride || userSettings.split;
    const duration = parseInt(userSettings.duration, 10);
    let count = Math.max(3, Math.floor(duration / 7.5));
    if (isDeloadWeek) count = Math.max(2, Math.floor(count * 0.8));

    let dataset = [...DEFAULT_EXERCISES, ...customExercises];
    let available = [];

    if (profile === "calisthenics") {
      available = getCalisthenicsPool();
    } else {
      const activeEquip = userSettings.equipment.map((e) => e.toLowerCase().trim());
      available = dataset.filter((ex) => activeEquip.includes((ex.equipment || "").toLowerCase().trim()));

      if (profile === "powerlifter") {
        available = available.filter((ex) =>
          POWERLIFTER_COMPOUNDS.some((c) => ex.name.toLowerCase().includes(c))
        );
      }
    }

    let targetMuscles = [];
    let title = `${profile.toUpperCase()} SESSION`;

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
    } else if (split === "ppl") {
      title = "PPL COMBINED SESSION";
    }

    let pool = available;
    if (targetMuscles.length > 0) {
      pool = available.filter((ex) => targetMuscles.includes((ex.target || "").toLowerCase().trim()));
    }
    if (pool.length < count) pool = available.length > 0 ? available : dataset;

    let selected = [];
    let poolCopy = [...pool];

    if (userSettings.supersets) {
      let pairCount = 1;
      while (selected.length < count && poolCopy.length > 0) {
        const ex1 = poolCopy.splice(Math.floor(Math.random() * poolCopy.length), 1)[0];
        ex1.supersetGroup = `SUPERSET ${pairCount} - A`;
        selected.push(ex1);

        if (selected.length >= count) break;
        const antagonists = ANTAGONIST_MAP[ex1.target] || [];
        const ex2Idx = poolCopy.findIndex((ex) => antagonists.includes((ex.target || "").toLowerCase()));

        if (ex2Idx !== -1) {
          const ex2 = poolCopy.splice(ex2Idx, 1)[0];
          ex2.supersetGroup = `SUPERSET ${pairCount} - B`;
          selected.push(ex2);
        }
        pairCount++;
      }
    } else {
      while (selected.length < count && poolCopy.length > 0) {
        selected.push(poolCopy.splice(Math.floor(Math.random() * poolCopy.length), 1)[0]);
      }
    }

    const mobility = generateTargetedMobility(selected);
    const newSession = { title, exercises: selected, isDeloadWeek, ...mobility };
    setGeneratedSession(newSession);
  };

  const generateTargetedMobility = (exercises) => {
    const muscles = new Set();
    exercises.forEach((ex) => {
      const t = (ex.target || "").toLowerCase();
      if (t.includes("chest")) muscles.add("chest");
      if (t.includes("shoulder")) muscles.add("shoulders");
      if (t.includes("lat") || t.includes("back")) muscles.add("lats");
      if (t.includes("quad")) muscles.add("quads");
      if (t.includes("hamstring")) muscles.add("hamstrings");
      if (t.includes("glute")) muscles.add("glutes");
    });
    if (muscles.size === 0) muscles.add("shoulders");

    const warmups = [];
    const cooldowns = [];
    muscles.forEach((m) => {
      if (DYNAMIC_WARMUP_LIBRARY[m]) warmups.push(...DYNAMIC_WARMUP_LIBRARY[m]);
      if (COOL_DOWN_STRETCH_LIBRARY[m]) cooldowns.push(...COOL_DOWN_STRETCH_LIBRARY[m]);
    });
    return { warmups, cooldowns };
  };

  // Progression Target Calculator (Juggernaut 4-Week Wave Loading)
  const getProgressionTarget = (scheme, weekNum) => {
    if (scheme === "juggernaut") {
      const wave = Math.ceil((weekNum % 16) / 4) || 1;
      if (weekNum % 4 === 0) return { reps: 5, setLabel: "Deload (60%)" };
      if (wave === 1) return { reps: 10, setLabel: "4 Wk Wave 10s (70%)" };
      if (wave === 2) return { reps: 8, setLabel: "4 Wk Wave 8s (75%)" };
      if (wave === 3) return { reps: 5, setLabel: "4 Wk Wave 5s (80%)" };
      return { reps: 3, setLabel: "4 Wk Wave 3s (85%)" };
    }
    if (scheme === "five_three_one") {
      const w = ((weekNum - 1) % 4) + 1;
      if (w === 1) return { reps: 5, setLabel: "5/5/5+ Set" };
      if (w === 2) return { reps: 3, setLabel: "3/3/3+ Set" };
      if (w === 3) return { reps: 1, setLabel: "5/3/1+ Set" };
      return { reps: 5, setLabel: "Deload Set" };
    }
    if (scheme === "conjugate") {
      return weekNum % 2 !== 0 ? { reps: 3, setLabel: "Max Effort (90%+)" } : { reps: 2, setLabel: "Dynamic Speed (50-60%)" };
    }
    return { reps: userSettings.profile === "powerlifter" ? 5 : 10, setLabel: "Linear" };
  };

  // Start Active Workout
  const startActiveWorkout = (session) => {
    const weekNum = session.weekNum || 1;
    const targetInfo = getProgressionTarget(userSettings.progressionScheme, weekNum);

    const activeSession = {
      ...session,
      startTime: new Date().toISOString(),
      logs: session.exercises.map((ex) => {
        const key = ex.id || ex.name;
        const lastRec = exerciseHistory[key];
        const defaultSets = [
          { reps: targetInfo.reps, weight: lastRec?.lastWeight || 100, completed: false },
          { reps: targetInfo.reps, weight: lastRec?.lastWeight || 100, completed: false },
          { reps: targetInfo.reps, weight: lastRec?.lastWeight || 100, completed: false }
        ];
        return {
          id: key,
          name: ex.name,
          supersetGroup: ex.supersetGroup || null,
          targetLabel: targetInfo.setLabel,
          sets: defaultSets
        };
      })
    };

    setActiveWorkout(activeSession);
    localStorage.setItem("gymbro_active_session", JSON.stringify(activeSession));
    setShowActiveModal(true);
  };

  const toggleSetComplete = (exIdx, setIdx) => {
    if (!activeWorkout) return;
    const updated = { ...activeWorkout };
    const current = updated.logs[exIdx].sets[setIdx].completed;
    updated.logs[exIdx].sets[setIdx].completed = !current;

    setActiveWorkout(updated);
    localStorage.setItem("gymbro_active_session", JSON.stringify(updated));

    if (!current) startRestTimer();
  };

  const updateSetVal = (exIdx, setIdx, field, val) => {
    if (!activeWorkout) return;
    const updated = { ...activeWorkout };
    updated.logs[exIdx].sets[setIdx][field] = parseFloat(val) || 0;
    setActiveWorkout(updated);
    localStorage.setItem("gymbro_active_session", JSON.stringify(updated));
  };

  const finishWorkout = () => {
    if (!activeWorkout) return;
    let totalVol = 0;
    let totalSets = 0;

    const newExHistory = { ...exerciseHistory };
    const exerciseBreakdowns = activeWorkout.logs.map((ex) => {
      let exVol = 0;
      let maxW = 0;
      let maxR = 0;
      ex.sets.forEach((s) => {
        const setVol = (s.weight || 0) * (s.reps || 0);
        exVol += setVol;
        totalVol += setVol;
        totalSets++;
        if (s.weight >= maxW) { maxW = s.weight; maxR = s.reps; }
      });
      newExHistory[ex.id] = { lastWeight: maxW, lastReps: maxR, sets: ex.sets };
      return { name: ex.name, sets: ex.sets, exerciseVolume: exVol };
    });

    const newHistory = [
      {
        id: `log_${Date.now()}`,
        title: activeWorkout.title,
        date: new Date().toLocaleDateString(),
        exerciseCount: activeWorkout.logs.length,
        totalCompletedSets: totalSets,
        totalVolume: totalVol,
        exercises: exerciseBreakdowns
      },
      ...workoutHistory
    ];

    setWorkoutHistory(newHistory);
    setExerciseHistory(newExHistory);
    localStorage.setItem("gymbro_history", JSON.stringify(newHistory));
    localStorage.setItem("gymbro_exercise_history", JSON.stringify(newExHistory));
    localStorage.removeItem("gymbro_active_session");

    if (currentUser && db) {
      db.ref(`users/${currentUser.uid}`).update({ history: newHistory, exercise_history: newExHistory });
    }

    setActiveWorkout(null);
    setShowActiveModal(false);
    setShowTimerBar(false);
    alert(`Workout Complete! Total Volume Lifted: ${totalVol.toLocaleString()} lbs`);
  };

  // CSV Export
  const exportCSV = () => {
    if (!workoutHistory.length) return alert("No workout history to export.");
    let csv = "Date,Workout Title,Exercises Completed,Total Volume (lbs)\n";
    workoutHistory.forEach((r) => {
      csv += `"${r.date}","${r.title.replace(/"/g, '""')}",${r.exerciseCount},${r.totalVolume}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omnipath_progress_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a);
  };

  // Toggle Calisthenics pathway skill step
  const toggleSkill = (category, level) => {
    const current = userSettings.calisthenicsUnlocked?.[category] || [1];
    const exists = current.includes(level);
    const updatedCategory = exists ? current.filter((l) => l !== level) : [...current, level];

    const updated = {
      ...userSettings,
      calisthenicsUnlocked: {
        ...userSettings.calisthenicsUnlocked,
        [category]: updatedCategory
      }
    };
    setUserSettings(updated);
  };

  // Build Multi-Month Plan
  const buildPlan = (months) => {
    const totalWeeks = months * 4;
    const schedulePattern = [
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
      const isDeload = w % 4 === 0;
      const days = schedulePattern.map((d, idx) => ({
        id: `w${w}_d${idx + 1}`,
        dayNum: idx + 1,
        title: `${d.name}${isDeload ? " (Deload)" : ""}`,
        type: d.type,
        isDeload,
        completed: false
      }));
      weeks.push({ weekNum: w, isDeload, days });
    }

    const plan = { months, totalWeeks, weeks, createdAt: new Date().toISOString() };
    setActivePlan(plan);
    localStorage.setItem(`gymbro_active_plan_${userSettings.profile || "standard"}`, JSON.stringify(plan));
  };

  const formattedTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`app-container theme-${userSettings.profile} bg-slate-950 text-slate-100 min-h-screen p-4 font-sans`}>
      {/* Top Navigation Header */}
      <header className="flex justify-between items-center border-b border-slate-800 pb-3 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-wider text-amber-400">OmniPathWorkout</h1>
          <div className="text-xs tracking-widest text-slate-400 font-semibold">{userSettings.profile.toUpperCase()} PROFILE</div>
        </div>
        <div className="flex gap-2">
          {activeWorkout && (
            <button
              onClick={() => setShowActiveModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold px-3 py-1.5 rounded animate-pulse"
            >
              RESUME WORKOUT
            </button>
          )}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded border border-slate-700"
          >
            SETTINGS
          </button>
        </div>
      </header>

      {/* Primary Tab Navigation */}
      <nav className="flex gap-2 border-b border-slate-800 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("generator")}
          className={`px-4 py-2 text-xs font-bold rounded-t border-b-2 whitespace-nowrap ${
            activeTab === "generator" ? "border-amber-400 text-amber-400 bg-slate-900" : "border-transparent text-slate-400"
          }`}
        >
          QUICK GENERATOR
        </button>
        <button
          onClick={() => setActiveTab("plan")}
          className={`px-4 py-2 text-xs font-bold rounded-t border-b-2 whitespace-nowrap ${
            activeTab === "plan" ? "border-amber-400 text-amber-400 bg-slate-900" : "border-transparent text-slate-400"
          }`}
        >
          MULTI-MONTH PLAN
        </button>
        <button
          onClick={() => setActiveTab("pathways")}
          className={`px-4 py-2 text-xs font-bold rounded-t border-b-2 whitespace-nowrap ${
            activeTab === "pathways" ? "border-amber-400 text-amber-400 bg-slate-900" : "border-transparent text-slate-400"
          }`}
        >
          PROGRESSION PATHWAYS
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-xs font-bold rounded-t border-b-2 whitespace-nowrap ${
            activeTab === "history" ? "border-amber-400 text-amber-400 bg-slate-900" : "border-transparent text-slate-400"
          }`}
        >
          PROGRESS LOG
        </button>
      </nav>

      {/* Main Tab Views */}
      <main className="max-w-4xl mx-auto">
        {/* Tab 1: Quick Generator */}
        {activeTab === "generator" && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="font-bold text-slate-200">Generate Session</h3>
                <p className="text-xs text-slate-400">Duration: {userSettings.duration} Mins | Split: {userSettings.split.toUpperCase()}</p>
              </div>
              <button
                onClick={() => generateWorkout()}
                className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm px-4 py-2 rounded"
              >
                GENERATE NOW
              </button>
            </div>

            {generatedSession && (
              <div className="bg-slate-900 p-5 rounded-lg border border-amber-400/30 space-y-6">
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="text-xl font-bold text-amber-400">{generatedSession.title}</h2>
                    {userSettings.profile !== "calisthenics" && (
                      <p className="text-xs text-slate-400">Progression Scheme: {userSettings.progressionScheme.toUpperCase()}</p>
                    )}
                  </div>
                  <button
                    onClick={() => startActiveWorkout(generatedSession)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-4 py-2 rounded"
                  >
                    START WORKOUT
                  </button>
                </div>

                {/* Dynamic Warm-up at TOP */}
                {generatedSession.warmups && generatedSession.warmups.length > 0 && (
                  <div className="bg-slate-950/60 p-4 rounded border border-amber-500/20">
                    <h4 className="text-xs font-bold text-amber-400 mb-2 tracking-wider">🔥 DYNAMIC WARM-UP (TOP)</h4>
                    <div className="space-y-2">
                      {generatedSession.warmups.map((w, idx) => (
                        <div key={idx} className="flex justify-between text-xs border-b border-slate-800/50 pb-1">
                          <span className="font-semibold text-slate-300">{w.name}</span>
                          <span className="text-amber-300">{w.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Exercises in MIDDLE */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 tracking-wider">💪 TARGETED EXERCISES</h4>
                  {generatedSession.exercises.map((ex, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded border border-slate-800 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-sm text-slate-200">{ex.name}</div>
                        <div className="text-xs text-slate-500">Target: {ex.target} | Equip: {ex.equipment}</div>
                      </div>
                      {ex.supersetGroup && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          {ex.supersetGroup}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Cool-down Stretches at BOTTOM */}
                {generatedSession.cooldowns && generatedSession.cooldowns.length > 0 && (
                  <div className="bg-slate-950/60 p-4 rounded border border-slate-700/30">
                    <h4 className="text-xs font-bold text-slate-400 mb-2 tracking-wider">🧘 COOL-DOWN STRETCHES (BOTTOM)</h4>
                    <div className="space-y-2">
                      {generatedSession.cooldowns.map((c, idx) => (
                        <div key={idx} className="flex justify-between text-xs border-b border-slate-800/50 pb-1">
                          <span className="font-semibold text-slate-300">{c.name}</span>
                          <span className="text-slate-400">{c.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Multi-Month Plan */}
        {activeTab === "plan" && (
          <div className="space-y-6">
            {!activePlan ? (
              <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 text-center space-y-4">
                <h3 className="font-bold text-slate-200 text-lg">Build Multi-Month Program</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Generate a structured training plan with progressive overload and scheduled deload weeks.
                </p>
                <div className="flex justify-center gap-3">
                  <button onClick={() => buildPlan(1)} className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs px-4 py-2 rounded border border-amber-400/30">
                    1 Month (4 Wks)
                  </button>
                  <button onClick={() => buildPlan(3)} className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs px-4 py-2 rounded border border-amber-400/30">
                    3 Months (12 Wks)
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-amber-400">{activePlan.months}-Month Training Program</h3>
                  <button onClick={() => setActivePlan(null)} className="text-xs text-rose-400 hover:underline">
                    Reset Plan
                  </button>
                </div>
                <div className="space-y-3">
                  {activePlan.weeks.slice(0, 4).map((w) => (
                    <div key={w.weekNum} className="bg-slate-950 p-3 rounded border border-slate-800">
                      <div className="text-xs font-bold text-amber-400/90 mb-2">
                        WEEK {w.weekNum} {w.isDeload ? "(DELOAD WEEK)" : ""}
                      </div>
                      <div className="space-y-1">
                        {w.days.map((d) => (
                          <div key={d.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/40">
                            <span className="text-slate-300">{d.title}</span>
                            {d.type !== "rest" ? (
                              <button
                                onClick={() => {
                                  const session = { title: `Week ${w.weekNum} - ${d.title}`, exercises: DEFAULT_EXERCISES.slice(0, 4) };
                                  startActiveWorkout(session);
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] font-bold px-2 py-1 rounded"
                              >
                                START
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-bold">REST</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Progression Pathways */}
        {activeTab === "pathways" && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
              <h3 className="font-bold text-slate-200">Calisthenics Skill Pathways</h3>
              <p className="text-xs text-slate-400">
                Check mastered skills. Checked skills and the single skill immediately following them are included in the workout generator pool.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.keys(CALISTHENICS_SKILL_TREES).map((cat) => {
                const pathway = CALISTHENICS_SKILL_TREES[cat];
                const unlocked = userSettings.calisthenicsUnlocked?.[cat] || [1];

                return (
                  <div key={cat} className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-3">
                    <h4 className="font-bold text-amber-400 text-sm tracking-wider uppercase">{cat} PATHWAY</h4>
                    <div className="space-y-2">
                      {pathway.map((item) => {
                        const isChecked = unlocked.includes(item.level);
                        return (
                          <div key={item.level} className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800">
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSkill(cat, item.level)}
                                className="accent-amber-400"
                              />
                              <span className={isChecked ? "text-slate-100 font-bold" : "text-slate-400"}>
                                L{item.level}: {item.name}
                              </span>
                            </label>
                            <span className="text-[10px] text-slate-500">{item.reps}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Progress Log */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-200">Completed Sessions</h3>
              <button onClick={exportCSV} className="bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold px-3 py-1.5 rounded border border-slate-700">
                EXPORT CSV
              </button>
            </div>

            {workoutHistory.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No completed workout sessions logged yet.</p>
            ) : (
              <div className="space-y-3">
                {workoutHistory.map((item) => (
                  <div key={item.id} className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-slate-200">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.date} • {item.exerciseCount} Exercises • {item.totalCompletedSets} Sets</div>
                    </div>
                    <div className="text-amber-400 font-bold text-sm bg-amber-400/10 px-3 py-1 rounded border border-amber-400/20">
                      {item.totalVolume.toLocaleString()} lbs
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Sticky Rest Timer Bar */}
      {showTimerBar && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900 text-slate-100 border border-amber-400/40 rounded-full px-6 py-3 shadow-2xl flex items-center gap-4 z-40">
          <div className="text-xs font-bold text-amber-400">REST TIMER</div>
          <div className="text-lg font-black tracking-widest text-slate-100">{formattedTime(timerRemaining)}</div>
          <button
            onClick={() => setIsTimerPaused(!isTimerPaused)}
            className="text-xs font-bold bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-slate-200"
          >
            {isTimerPaused ? "RESUME" : "PAUSE"}
          </button>
          <button
            onClick={() => setShowTimerBar(false)}
            className="text-xs font-bold text-slate-400 hover:text-slate-200"
          >
            SKIP
          </button>
        </div>
      )}

      {/* Active Workout Modal */}
      {showActiveModal && activeWorkout && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 overflow-y-auto p-4 flex justify-center">
          <div className="bg-slate-900 border border-slate-800 max-w-2xl w-full rounded-lg p-6 space-y-6 my-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-xl font-bold text-amber-400">{activeWorkout.title}</h2>
                <div className="text-xs text-slate-400">ACTIVE SESSION LOGGING</div>
              </div>
              <button onClick={() => setShowActiveModal(false)} className="text-slate-400 hover:text-slate-200 text-sm font-bold">
                MINIMIZE
              </button>
            </div>

            {/* Dynamic Warm-up at TOP */}
            {activeWorkout.warmups && activeWorkout.warmups.length > 0 && (
              <div className="bg-slate-950 p-3 rounded border border-amber-400/20">
                <h4 className="text-xs font-bold text-amber-400 mb-2">🔥 DYNAMIC WARM-UP (TOP)</h4>
                <div className="space-y-1">
                  {activeWorkout.warmups.map((w, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-300">
                      <span>{w.name}</span>
                      <span className="text-amber-300">{w.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exercises List in MIDDLE */}
            <div className="space-y-4">
              {activeWorkout.logs.map((ex, exIdx) => (
                <div key={exIdx} className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2">
                  <div className="font-bold text-sm text-slate-200">{ex.name}</div>
                  <div className="space-y-1">
                    {ex.sets.map((set, setIdx) => (
                      <div key={setIdx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/40">
                        <span className="text-slate-400">Set {setIdx + 1}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={set.weight}
                            onChange={(e) => updateSetVal(exIdx, setIdx, "weight", e.target.value)}
                            className="w-16 bg-slate-900 border border-slate-700 text-center rounded text-slate-100 px-1 py-0.5"
                          />
                          <span className="text-slate-500">lbs</span>
                          <input
                            type="number"
                            value={set.reps}
                            onChange={(e) => updateSetVal(exIdx, setIdx, "reps", e.target.value)}
                            className="w-12 bg-slate-900 border border-slate-700 text-center rounded text-slate-100 px-1 py-0.5"
                          />
                          <span className="text-slate-500">reps</span>
                        </div>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={set.completed}
                            onChange={() => toggleSetComplete(exIdx, setIdx)}
                            className="accent-amber-400"
                          />
                          <span className={set.completed ? "text-emerald-400 font-bold" : "text-slate-500"}>DONE</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Cool-down Stretches at BOTTOM */}
            {activeWorkout.cooldowns && activeWorkout.cooldowns.length > 0 && (
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <h4 className="text-xs font-bold text-slate-400 mb-2">🧘 COOL-DOWN STRETCHES (BOTTOM)</h4>
                <div className="space-y-1">
                  {activeWorkout.cooldowns.map((c, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-300">
                      <span>{c.name}</span>
                      <span className="text-slate-400">{c.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={finishWorkout}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm py-3 rounded"
            >
              FINISH & LOG WORKOUT
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-bold text-amber-400 border-b border-slate-800 pb-2">App Settings</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Target App Profile Preset</label>
                <select
                  value={userSettings.profile}
                  onChange={(e) => setUserSettings({ ...userSettings, profile: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200"
                >
                  <option value="standard">Standard Hypertrophy</option>
                  <option value="powerlifter">Powerlifter Compound Focus</option>
                  <option value="calisthenics">Calisthenics Bodyweight Focus</option>
                </select>
              </div>

              {userSettings.profile !== "calisthenics" && (
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Progression Scheme</label>
                  <select
                    value={userSettings.progressionScheme}
                    onChange={(e) => setUserSettings({ ...userSettings, progressionScheme: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="linear">Linear Progression</option>
                    <option value="juggernaut">4 Week Wave Loading</option>
                    <option value="five_three_one">5/3/1 Wendler System</option>
                    <option value="conjugate">Conjugate Method</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Workout Split Focus</label>
                <select
                  value={userSettings.split}
                  onChange={(e) => setUserSettings({ ...userSettings, split: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200"
                >
                  <option value="upper_lower">Upper / Lower Body Split</option>
                  <option value="ppl">Push / Pull / Legs (PPL Combined)</option>
                  <option value="ppl_push">Push Only (PPL)</option>
                  <option value="ppl_pull">Pull Only (PPL)</option>
                  <option value="ppl_legs">Legs Only (PPL)</option>
                  <option value="full_body">Full Body Focus</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs py-2 rounded"
            >
              SAVE SETTINGS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
