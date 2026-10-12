import React, { useState, useEffect } from "react";
import { auth } from "./config/firebase";
import {
  startRestTimer,
  adjustRestTimer,
  togglePauseRestTimer,
  stopRestTimer
} from "./services/timerEngine";
import {
  getPlanStorageKey,
  syncUserDataFromCloud,
  saveUserDataToCloud,
  exportHistoryToCSV
} from "./services/dbService";
import {
  DEFAULT_SETTINGS,
  DEFAULT_MAX_LIFTS,
  CALISTHENICS_SKILL_TREES,
  calculateProgressionSetTargets,
  generateWorkoutSession
} from "./services/workoutEngine";

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

export default function App() {
  const [userSettings, setUserSettings] = useState(() => {
    const saved = getSafeLocalStorage("gymbro_settings", DEFAULT_SETTINGS);
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      maxLifts: { ...DEFAULT_MAX_LIFTS, ...(saved?.maxLifts || {}) }
    };
  });

  const [workoutHistory, setWorkoutHistory] = useState(() => getSafeLocalStorage("gymbro_history", []));
  const [exerciseHistory, setExerciseHistory] = useState(() => getSafeLocalStorage("gymbro_exercise_history", {}));
  const [customExercises, setCustomExercises] = useState(() => getSafeLocalStorage("gymbro_custom_exercises", []));
  const [activePlan, setActivePlan] = useState(() => getSafeLocalStorage(getPlanStorageKey(userSettings.profile || "standard"), null));
  const [activeWorkout, setActiveWorkout] = useState(() => getSafeLocalStorage("gymbro_active_session", null));

  const [activeTab, setActiveTab] = useState("generator");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showActiveModal, setShowActiveModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSearchPickerModal, setShowSearchPickerModal] = useState(false);
  const [pickerTargetSlot, setPickerTargetSlot] = useState(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Program Builder & Standard Plan State
  const [standardPlanMonths, setStandardPlanMonths] = useState(1);
  const [pbDurationWeeks, setPbDurationWeeks] = useState(4);
  const [pbProgressionRate, setPbProgressionRate] = useState(2.5);
  const [pbExercisesPerSession, setPbExercisesPerSession] = useState(5);
  const [pbRestTime, setPbRestTime] = useState(90);
  const [pbWorkoutsPerWeek, setPbWorkoutsPerWeek] = useState(4);

  const [currentUser, setCurrentUser] = useState(null);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [customExName, setCustomExName] = useState("");
  const [customExTarget, setCustomExTarget] = useState("chest");
  const [customExEquipment, setCustomExEquipment] = useState("barbell");
  const [customExPattern, setCustomExPattern] = useState("horizontal push");

  const [generatedSession, setGeneratedSession] = useState(null);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [showTimerBar, setShowTimerBar] = useState(false);

  useEffect(() => {
    localStorage.setItem("gymbro_settings", JSON.stringify(userSettings));
    const planKey = getPlanStorageKey(userSettings.profile || "standard");
    setActivePlan(getSafeLocalStorage(planKey, null));
  }, [userSettings]);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
        setShowAuthModal(false);
        syncUserDataFromCloud(user.uid, (data) => {
          if (data.settings) {
            setUserSettings((prev) => ({
              ...DEFAULT_SETTINGS,
              ...data.settings,
              maxLifts: { ...DEFAULT_MAX_LIFTS, ...(data.settings.maxLifts || {}) }
            }));
          }
          if (data.history) setWorkoutHistory(data.history);
          if (data.exercise_history) setExerciseHistory(data.exercise_history);
          if (data.custom_exercises) setCustomExercises(data.custom_exercises);
        });
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleStartTimer = (secs) => {
    const time = secs || userSettings.restTime || 60;
    setShowTimerBar(true);
    setIsTimerPaused(false);
    startRestTimer(
      time,
      (rem) => setTimerRemaining(rem),
      () => setShowTimerBar(false)
    );
  };

  const handleAdjustTimer = (delta) => adjustRestTimer(delta, (rem) => setTimerRemaining(rem));

  const handleTogglePauseTimer = () => {
    const paused = togglePauseRestTimer();
    setIsTimerPaused(paused);
  };

  const handleStopTimer = () => {
    stopRestTimer();
    setShowTimerBar(false);
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setAuthError("");
    if (!auth) return setAuthError("Firebase Auth not initialized.");

    if (isSignUpMode) {
      auth.createUserWithEmailAndPassword(authEmail, authPassword).catch((err) => setAuthError(err.message));
    } else {
      auth.signInWithEmailAndPassword(authEmail, authPassword).catch((err) => setAuthError(err.message));
    }
  };

  const handleSignOut = () => { if (auth) auth.signOut(); };

  const handleToggleCalisthenicsSkill = (skillName) => {
    const current = userSettings.calisthenicsUnlocked || [];
    const updated = current.includes(skillName)
      ? current.filter(n => n !== skillName)
      : [...current, skillName];
    setUserSettings({ ...userSettings, calisthenicsUnlocked: updated });
  };

  const handleGenerate = (splitOverride = null) => {
    const session = generateWorkoutSession(userSettings, customExercises, splitOverride);
    setGeneratedSession(session);
  };

  const startActiveWorkout = (session) => {
    const weekNum = session.weekNum || 1;
    const scheme = userSettings.progressionScheme || "linear";

    const activeSession = {
      ...session,
      startTime: new Date().toISOString(),
      logs: session.exercises.map((ex) => {
        const key = ex.id || ex.name;
        const lastRec = exerciseHistory[key];
        const sets = [];
        for (let i = 0; i < 3; i++) {
          const target = calculateProgressionSetTargets(ex, scheme, weekNum, i, userSettings);
          sets.push({
            reps: target.reps,
            weight: target.isBodyweight ? 0 : target.weight,
            completed: false,
            label: target.label
          });
        }
        return {
          id: key,
          name: ex.name,
          lastRecord: lastRec ? `${lastRec.lastWeight} lbs × ${lastRec.lastReps} reps` : null,
          suggestOverload: lastRec && lastRec.lastReps >= 10,
          sets
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

    if (!current && userSettings.autoStartTimer) handleStartTimer();
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
    activeWorkout.logs.forEach((ex) => {
      let maxW = 0, maxR = 0;
      ex.sets.forEach((s) => {
        if (s.completed) {
          const setVol = (s.weight || 0) * (s.reps || 0);
          totalVol += setVol;
          totalSets++;
          if (s.weight >= maxW) { maxW = s.weight; maxR = s.reps; }
        }
      });
      newExHistory[ex.id] = { lastWeight: maxW, lastReps: maxR };
    });

    const newHistory = [
      {
        id: `log_${Date.now()}`,
        title: activeWorkout.title,
        date: new Date().toLocaleDateString(),
        exerciseCount: activeWorkout.logs.length,
        totalCompletedSets: totalSets,
        totalVolume: totalVol,
        logs: activeWorkout.logs // Store detailed nested sets for expansion maps and CSV
      },
      ...workoutHistory
    ];

    setWorkoutHistory(newHistory);
    setExerciseHistory(newExHistory);
    localStorage.setItem("gymbro_history", JSON.stringify(newHistory));
    localStorage.setItem("gymbro_exercise_history", JSON.stringify(newExHistory));
    
    if (activeWorkout.planDayRef && activePlan) {
      const updatedPlan = { ...activePlan };
      updatedPlan.weeks.forEach((w) => {
        w.days.forEach((d) => {
          if (d.id === activeWorkout.planDayRef) d.completed = true;
        });
      });
      setActivePlan(updatedPlan);
      localStorage.setItem(getPlanStorageKey(userSettings.profile), JSON.stringify(updatedPlan));
    }

    localStorage.removeItem("gymbro_active_session");

    if (currentUser) {
      saveUserDataToCloud(currentUser.uid, {
        settings: userSettings,
        history: newHistory,
        exerciseHistory: newExHistory,
        customExercises,
        calisthenicsSkills: userSettings.calisthenicsUnlocked
      }, userSettings.profile || "standard", activePlan);
    }

    setActiveWorkout(null);
    setShowActiveModal(false);
    handleStopTimer();
    alert(`Workout Logged! Total Volume: ${totalVol.toLocaleString()} lbs`);
  };

  const handleSaveCustomExercise = (e) => {
    e.preventDefault();
    if (!customExName.trim()) return;

    const newEx = {
      id: `custom_${Date.now()}`,
      name: customExName.trim(),
      target: customExTarget,
      equipment: customExEquipment,
      movement_pattern: customExPattern
    };

    const updated = [...customExercises, newEx];
    setCustomExercises(updated);
    localStorage.setItem("gymbro_custom_exercises", JSON.stringify(updated));

    if (currentUser) {
      saveUserDataToCloud(currentUser.uid, {
        settings: userSettings,
        history: workoutHistory,
        exerciseHistory,
        customExercises: updated,
        calisthenicsSkills: userSettings.calisthenicsUnlocked
      });
    }

    setCustomExName("");
    alert("Custom exercise added successfully!");
  };

  const buildStandardProgramCycle = () => {
    const totalWeeks = standardPlanMonths * 4;
    const schedule = [];
    const splits = userSettings.split.includes("ppl") 
      ? ["ppl_push", "ppl_pull", "ppl_legs", "rest", "ppl_push", "ppl_pull", "rest"]
      : ["upper", "lower", "rest", "upper", "lower", "rest", "rest"];

    for (let w = 1; w <= totalWeeks; w++) {
      const days = [];
      for (let d = 1; d <= 7; d++) {
        const splitType = splits[d - 1];
        days.push({
          id: `w${w}_d${d}`,
          dayNum: d,
          title: splitType === "rest" ? "Rest Day" : `Workout: ${splitType.toUpperCase()}`,
          type: splitType,
          completed: false
        });
      }
      schedule.push({ weekNum: w, days });
    }

    const plan = { type: "standard_plan", weeks: schedule };
    setActivePlan(plan);
    localStorage.setItem(getPlanStorageKey(userSettings.profile || "standard"), JSON.stringify(plan));
  };

  const buildProgramBuilderCycle = () => {
    const totalWeeks = pbDurationWeeks;
    const schedule = [];

    for (let w = 1; w <= totalWeeks; w++) {
      const days = [];
      for (let d = 1; d <= pbWorkoutsPerWeek; d++) {
        days.push({
          id: `w${w}_d${d}`,
          dayNum: d,
          title: `Day ${d} Session`,
          exercises: Array(pbExercisesPerSession).fill(null)
        });
      }
      schedule.push({ weekNum: w, days });
    }

    const plan = {
      type: "program_builder",
      weeks: schedule,
      progressionRate: pbProgressionRate,
      restTime: pbRestTime
    };

    setActivePlan(plan);
    localStorage.setItem(getPlanStorageKey("program_builder"), JSON.stringify(plan));
  };

  const assignExerciseToSlot = (ex) => {
    if (!pickerTargetSlot || !activePlan) return;
    const { weekNum, dayNum, slotIdx } = pickerTargetSlot;

    const updatedWeeks = activePlan.weeks.map((w) => {
      if (w.weekNum === weekNum) {
        const updatedDays = w.days.map((d) => {
          if (d.dayNum === dayNum) {
            const updatedExs = [...d.exercises];
            updatedExs[slotIdx] = ex;
            return { ...d, exercises: updatedExs };
          }
          return d;
        });
        return { ...w, days: updatedDays };
      }
      return w;
    });

    const updatedPlan = { ...activePlan, weeks: updatedWeeks };
    setActivePlan(updatedPlan);
    localStorage.setItem(getPlanStorageKey("program_builder"), JSON.stringify(updatedPlan));
    setShowSearchPickerModal(false);
  };

  const startPlanDay = (day, weekNum) => {
    if (day.type === "rest") return;
    const session = generateWorkoutSession(userSettings, customExercises, day.type);
    session.title = `Week ${weekNum} - ${day.title}`;
    session.planDayRef = day.id;
    session.weekNum = weekNum;
    startActiveWorkout(session);
  };

  const formattedTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const themeClass = `theme-${userSettings.profile || "standard"}`;

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 p-4 font-sans ${themeClass}`}>
      <header className="flex justify-between items-center border-b border-slate-800 pb-3 mb-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-black tracking-wider text-amber-400">OmniPathWorkout</h1>
          <div className="text-xs tracking-widest text-slate-400 font-semibold uppercase">
            {(userSettings.profile || "standard").replace("_", " ")} WORKOUT STYLE
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {currentUser ? (
            <button onClick={handleSignOut} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300">
              {currentUser.email.split("@")[0]} (Logout)
            </button>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="text-xs bg-amber-500 hover:bg-amber-600 font-bold px-3 py-1.5 rounded text-slate-950">
              CREATE ACCOUNT / LOGIN
            </button>
          )}
          <button onClick={() => setShowSettingsModal(true)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded border border-slate-700">
            SETTINGS
          </button>
        </div>
      </header>

      <nav className="flex gap-2 border-b border-slate-800 mb-6 max-w-4xl mx-auto overflow-x-auto">
        <button onClick={() => setActiveTab("generator")} className={`px-4 py-2 text-xs font-bold rounded-t border-b-2 ${activeTab === "generator" ? "border-amber-400 text-amber-400 bg-slate-900" : "text-slate-400"}`}>
          QUICK GENERATOR
        </button>
        <button onClick={() => setActiveTab("plan")} className={`px-4 py-2 text-xs font-bold rounded-t border-b-2 ${activeTab === "plan" ? "border-amber-400 text-amber-400 bg-slate-900" : "text-slate-400"}`}>
          PROGRAM PLANNER
        </button>
        {userSettings.profile === "calisthenics" && (
          <button onClick={() => setActiveTab("pathways")} className={`px-4 py-2 text-xs font-bold rounded-t border-b-2 ${activeTab === "pathways" ? "border-amber-400 text-amber-400 bg-slate-900" : "text-slate-400"}`}>
            PROGRESSION PATHWAYS
          </button>
        )}
        <button onClick={() => setActiveTab("history")} className={`px-4 py-2 text-xs font-bold rounded-t border-b-2 ${activeTab === "history" ? "border-amber-400 text-amber-400 bg-slate-900" : "text-slate-400"}`}>
          PROGRESS LOG
        </button>
      </nav>

      <main className="max-w-4xl mx-auto space-y-6">
        {activeTab === "generator" && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="font-bold text-slate-200">Session Routine Generator</h3>
                <p className="text-xs text-slate-400">Duration: {userSettings.duration}m | Injury Filter: {(userSettings.selectedInjury || "none").toUpperCase()}</p>
              </div>
              <button onClick={() => handleGenerate()} className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs px-4 py-2 rounded">
                GENERATE NOW
              </button>
            </div>

            {generatedSession && (
              <div className="bg-slate-900 p-5 rounded-lg border border-amber-400/30 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h2 className="text-xl font-bold text-amber-400">{generatedSession.title}</h2>
                  <button onClick={() => startActiveWorkout(generatedSession)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-4 py-2 rounded">
                    START WORKOUT
                  </button>
                </div>

                {generatedSession.warmups && generatedSession.warmups.length > 0 && (
                  <div className="bg-slate-950 p-4 rounded border border-amber-500/20">
                    <h4 className="text-xs font-bold text-amber-400 mb-2">🔥 DYNAMIC WARM-UP & PREHAB (TOP)</h4>
                    <div className="space-y-2">
                      {generatedSession.warmups.map((w, idx) => (
                        <div key={idx} className="flex justify-between text-xs border-b border-slate-800/50 pb-1">
                          <span className="font-semibold text-slate-300">{w.name} {w.isPrehab && <span className="text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/30 font-bold">PREHAB</span>}</span>
                          <span className="text-amber-300">{w.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400">💪 TARGETED EXERCISES</h4>
                  {generatedSession.exercises.map((ex, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded border border-slate-800 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-sm text-slate-200">{ex.name}</div>
                        <div className="text-xs text-slate-500">Target: {ex.target} | Equip: {ex.equipment}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {generatedSession.cooldowns && generatedSession.cooldowns.length > 0 && (
                  <div className="bg-slate-950 p-4 rounded border border-slate-700/30">
                    <h4 className="text-xs font-bold text-slate-400 mb-2">🧘 COOL-DOWN STRETCHES (BOTTOM)</h4>
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

        {activeTab === "plan" && (
          <div className="space-y-6">
            {userSettings.profile === "program_builder" ? (
              <div className="bg-slate-900 p-6 rounded-lg border border-cyan-500/30 space-y-4">
                <h3 className="font-bold text-cyan-400 text-lg">Program Builder Wizard</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Duration (Weeks)</label>
                    <select value={pbDurationWeeks} onChange={(e) => setPbDurationWeeks(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-700 p-2 rounded">
                      <option value={4}>4 Weeks (1 Month)</option>
                      <option value={8}>8 Weeks (2 Months)</option>
                      <option value={12}>12 Weeks (3 Months)</option>
                      <option value={16}>16 Weeks (4 Months)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Weekly Progression (%)</label>
                    <input type="number" step="0.5" value={pbProgressionRate} onChange={(e) => setPbProgressionRate(parseFloat(e.target.value))} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Exercises per Session</label>
                    <input type="number" value={pbExercisesPerSession} onChange={(e) => setPbExercisesPerSession(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Workouts per Week</label>
                    <input type="number" value={pbWorkoutsPerWeek} onChange={(e) => setPbWorkoutsPerWeek(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-100" />
                  </div>
                </div>
                <button onClick={buildProgramBuilderCycle} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs py-2 rounded">
                  BUILD CUSTOM SKELETON
                </button>

                {activePlan && activePlan.type === "program_builder" && (
                  <div className="space-y-4 mt-6 border-t border-slate-800 pt-4">
                    <h4 className="font-bold text-slate-200 text-sm">Interactive Program Cycle</h4>
                    {activePlan.weeks.map((w) => (
                      <div key={w.weekNum} className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
                        <div className="text-xs font-bold text-cyan-400">WEEK {w.weekNum}</div>
                        <div className="grid grid-cols-2 gap-2">
                          {w.days.map((d) => (
                            <div key={d.dayNum} className="bg-slate-900 p-2 rounded border border-slate-800 text-xs space-y-1">
                              <div className="font-bold text-slate-300">{d.title}</div>
                              {d.exercises.map((slot, sIdx) => (
                                <button key={sIdx} onClick={() => { setPickerTargetSlot({ weekNum: w.weekNum, dayNum: d.dayNum, slotIdx: sIdx }); setShowSearchPickerModal(true); }} className={`w-full text-left p-1.5 rounded text-[10px] font-semibold border ${slot ? "bg-slate-950 border-cyan-400/40 text-cyan-300" : "bg-slate-800/40 border-dashed border-slate-700 text-slate-500"}`}>
                                  {slot ? slot.name : `+ Slot ${sIdx + 1}`}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 space-y-4">
                <h3 className="font-bold text-amber-400 text-lg">Standard Program Generator</h3>
                <p className="text-xs text-slate-400">Generate a structured multi-week plan based on your current Workout Style, Split, and Progression Scheme.</p>
                <div>
                  <label className="block text-slate-400 mb-1 text-xs">Plan Duration</label>
                  <select value={standardPlanMonths} onChange={(e) => setStandardPlanMonths(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-700 p-2 text-xs rounded text-slate-200">
                    <option value={1}>1 Month (4 Weeks)</option>
                    <option value={2}>2 Months (8 Weeks)</option>
                    <option value={3}>3 Months (12 Weeks)</option>
                  </select>
                </div>
                <button onClick={buildStandardProgramCycle} className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs py-2 rounded">
                  GENERATE PLAN
                </button>

                {activePlan && activePlan.type === "standard_plan" && (
                  <div className="space-y-4 mt-6 border-t border-slate-800 pt-4">
                    {activePlan.weeks.map((w) => (
                      <div key={w.weekNum} className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
                        <div className="text-xs font-bold text-amber-400">WEEK {w.weekNum}</div>
                        <div className="grid grid-cols-1 gap-2">
                          {w.days.map((d) => (
                            <div key={d.id} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800 text-xs">
                              <span className={d.completed ? "text-slate-500 line-through" : "text-slate-200"}>Day {d.dayNum}: {d.title}</span>
                              {d.type !== "rest" && !d.completed && (
                                <button onClick={() => startPlanDay(d, w.weekNum)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-2 py-1 rounded font-bold">START</button>
                              )}
                              {d.completed && <span className="text-emerald-500 font-bold">DONE</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "pathways" && userSettings.profile === "calisthenics" && (
          <div className="space-y-4 bg-slate-900 p-5 rounded-lg border border-purple-500/30">
            <h3 className="font-bold text-purple-400 text-lg">Calisthenics Skill Progression Pathways</h3>
            <p className="text-xs text-slate-400">Check the skills you have mastered. The workout generator will only include your mastered skills plus the immediate next progression level.</p>
            {Object.entries(CALISTHENICS_SKILL_TREES).map(([treeKey, steps]) => (
              <div key={treeKey} className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold uppercase text-purple-300">{treeKey} Pathway</h4>
                <div className="space-y-1">
                  {steps.map((s) => {
                    const isChecked = (userSettings.calisthenicsUnlocked || []).includes(s.name);
                    return (
                      <label key={s.level} className={`flex items-center gap-3 text-xs p-2 rounded border cursor-pointer transition-colors ${isChecked ? 'bg-purple-900/30 border-purple-500/50' : 'bg-slate-900 border-slate-800/60'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCalisthenicsSkill(s.name)}
                          className="accent-purple-500 w-4 h-4"
                        />
                        <div className="flex-1 flex justify-between items-center">
                          <span className={isChecked ? 'text-purple-300 font-bold' : 'text-slate-300'}>
                            Lvl {s.level}: {s.name}
                          </span>
                          <span className="text-slate-500 text-[10px]">{s.reps}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-200">Completed Sessions</h3>
              <button onClick={() => exportHistoryToCSV(workoutHistory)} className="bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold px-3 py-1.5 rounded border border-slate-700">
                EXPORT LOG TO CSV
              </button>
            </div>
            {workoutHistory.map((item) => (
              <div key={item.id} className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedLogId(expandedLogId === item.id ? null : item.id)}>
                  <div>
                    <div className="font-bold text-sm text-slate-200">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.date} • {item.exerciseCount} Exercises • {item.totalCompletedSets} Sets</div>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="text-amber-400 font-bold text-sm bg-amber-400/10 px-3 py-1 rounded border border-amber-400/20">
                      {item.totalVolume.toLocaleString()} lbs
                    </div>
                    <div className="text-slate-400 text-xs">{expandedLogId === item.id ? '▲' : '▼'}</div>
                  </div>
                </div>
                {/* Expanded Details Map */}
                {expandedLogId === item.id && item.logs && (
                  <div className="mt-4 border-t border-slate-800 pt-4 space-y-3">
                    {item.logs.map((log, lIdx) => (
                      <div key={lIdx} className="text-xs text-slate-300">
                        <div className="font-bold text-amber-400 mb-1">{log.name}</div>
                        {log.sets.filter(s => s.completed).map((set, sIdx) => (
                          <div key={sIdx} className="ml-4 flex gap-4 text-slate-400 border-l border-slate-800 pl-2 mb-1">
                            <span>Set {sIdx + 1}:</span>
                            <span className="text-slate-200">{set.weight} lbs × {set.reps} reps</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Timer Bar */}
      {showTimerBar && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900 text-slate-100 border border-amber-400/40 rounded-full px-6 py-3 shadow-2xl flex items-center gap-4 z-[60]">
          <div className="text-xs font-bold text-amber-400">REST TIMER</div>
          <div className="text-lg font-black tracking-widest text-slate-100">{formattedTime(timerRemaining)}</div>
          <button onClick={() => handleAdjustTimer(-15)} className="text-xs font-bold bg-slate-800 px-2 py-1 rounded text-slate-300">-15s</button>
          <button onClick={() => handleAdjustTimer(15)} className="text-xs font-bold bg-slate-800 px-2 py-1 rounded text-slate-300">+15s</button>
          <button onClick={handleTogglePauseTimer} className="text-xs font-bold bg-slate-800 px-3 py-1 rounded text-slate-200">
            {isTimerPaused ? "RESUME" : "PAUSE"}
          </button>
          <button onClick={handleStopTimer} className="text-xs text-slate-400">SKIP</button>
        </div>
      )}

      {/* Active Workout Modal */}
      {showActiveModal && activeWorkout && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 max-w-2xl w-full rounded-lg p-6 space-y-6 my-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-xl font-bold text-amber-400">{activeWorkout.title}</h2>
                {showTimerBar && (
                  <div className="text-xs text-amber-300 font-mono mt-1 font-bold">⏱️ Rest Timer Active: {formattedTime(timerRemaining)}</div>
                )}
              </div>
              <button onClick={() => setShowActiveModal(false)} className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">MINIMIZE</button>
            </div>

            {/* Dynamic Warm-ups directly in the active session */}
            {activeWorkout.warmups && activeWorkout.warmups.length > 0 && (
              <div className="bg-slate-950 p-4 rounded border border-amber-500/20">
                <h4 className="text-xs font-bold text-amber-400 mb-2">🔥 DYNAMIC WARM-UP & PREHAB</h4>
                <div className="space-y-2">
                  {activeWorkout.warmups.map((w, idx) => (
                    <div key={idx} className="flex justify-between text-xs border-b border-slate-800/50 pb-1">
                      <span className="font-semibold text-slate-300">{w.name}</span>
                      <span className="text-amber-300">{w.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {activeWorkout.logs.map((ex, exIdx) => (
                <div key={exIdx} className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="font-bold text-sm text-slate-200">{ex.name}</div>
                    {ex.suggestOverload && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">+5 lbs Suggested</span>}
                  </div>
                  {ex.lastRecord && <div className="text-[10px] text-amber-400">Last Time: {ex.lastRecord}</div>}

                  <div className="space-y-1">
                    {ex.sets.map((set, setIdx) => (
                      <div key={setIdx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/40">
                        <span className="text-slate-400">Set {setIdx + 1}</span>
                        <div className="flex items-center gap-2">
                          <input type="number" value={set.weight} onChange={(e) => updateSetVal(exIdx, setIdx, "weight", e.target.value)} className="w-16 bg-slate-900 border border-slate-700 text-center rounded px-1 text-slate-100" />
                          <span className="text-slate-500">lbs</span>
                          <input type="number" value={set.reps} onChange={(e) => updateSetVal(exIdx, setIdx, "reps", e.target.value)} className="w-12 bg-slate-900 border border-slate-700 text-center rounded px-1 text-slate-100" />
                          <span className="text-slate-500">reps</span>
                        </div>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={set.completed} onChange={() => toggleSetComplete(exIdx, setIdx)} className="accent-amber-400" />
                          <span className={set.completed ? "text-emerald-400 font-bold" : "text-slate-500"}>DONE</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Static Cooldowns directly in the active session */}
            {activeWorkout.cooldowns && activeWorkout.cooldowns.length > 0 && (
              <div className="bg-slate-950 p-4 rounded border border-slate-700/30">
                <h4 className="text-xs font-bold text-slate-400 mb-2">🧘 COOL-DOWN STRETCHES</h4>
                <div className="space-y-2">
                  {activeWorkout.cooldowns.map((c, idx) => (
                    <div key={idx} className="flex justify-between text-xs border-b border-slate-800/50 pb-1">
                      <span className="font-semibold text-slate-300">{c.name}</span>
                      <span className="text-slate-400">{c.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={finishWorkout} className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm py-3 rounded">
              FINISH & LOG WORKOUT
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-amber-400 border-b border-slate-800 pb-2">Settings & Configuration</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Workout Style (Profile Preset)</label>
                <select value={userSettings.profile} onChange={(e) => setUserSettings({ ...userSettings, profile: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200">
                  <option value="standard">Standard Hypertrophy</option>
                  <option value="powerlifter">Powerlifter Heavy Compounds</option>
                  <option value="calisthenics">Calisthenics Bodyweight Flow</option>
                  <option value="program_builder">Program Builder Custom Wizard</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Session Duration Target</label>
                <select value={userSettings.duration} onChange={(e) => setUserSettings({ ...userSettings, duration: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200">
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                  <option value={90}>90+ Minutes</option>
                </select>
              </div>

              {userSettings.profile !== "calisthenics" && (
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Progression Scheme</label>
                <select value={userSettings.progressionScheme || "linear"} onChange={(e) => setUserSettings({ ...userSettings, progressionScheme: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200">
                  <option value="linear">Linear Progression (Beginner)</option>
                  <option value="five_three_one">5/3/1 Wave (Intermediate)</option>
                  <option value="juggernaut">Juggernaut 4-Week Wave (Intermediate)</option>
                  <option value="conjugate">Conjugate Max Effort (Advanced)</option>
                </select>
              </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Rest Timer (Seconds)</label>
                <input type="number" value={userSettings.restTime || 60} onChange={(e) => setUserSettings({ ...userSettings, restTime: parseInt(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200" />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Injury Contraindication Filter</label>
                <select value={userSettings.selectedInjury || "none"} onChange={(e) => setUserSettings({ ...userSettings, selectedInjury: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200">
                  <option value="none">None / Healthy</option>
                  <option value="shoulder_rotator_cuff">Shoulder / Rotator Cuff Strain</option>
                  <option value="lower_back">Lower Back Strain / Lumbar Disc</option>
                  <option value="knee_patellar">Knee / Patellar Tendonitis</option>
                  <option value="wrist_forearm">Wrist / Forearm Tendonitis</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Workout Split Focus</label>
                <select value={userSettings.split} onChange={(e) => setUserSettings({ ...userSettings, split: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200">
                  <option value="upper_lower">Upper / Lower Body Split</option>
                  <option value="upper">Upper Body Only</option>
                  <option value="lower">Lower Body Only</option>
                  <option value="ppl">Push / Pull / Legs (PPL Combined)</option>
                  <option value="ppl_push">Push Only (PPL)</option>
                  <option value="ppl_pull">Pull Only (PPL)</option>
                  <option value="ppl_legs">Legs Only (PPL)</option>
                  <option value="full_body">Full Body Focus</option>
                </select>
              </div>

              <div className="border-t border-slate-800 pt-2 space-y-2">
                <label className="block text-amber-400 font-bold">1RM Max Lifts Baseline (lbs)</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-500 text-[10px] mb-1">Bench Press</label>
                    <input type="number" value={userSettings.maxLifts?.benchPress || 185} onChange={(e) => setUserSettings({ ...userSettings, maxLifts: { ...userSettings.maxLifts, benchPress: e.target.value } })} className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded text-center text-slate-100" placeholder="Bench" />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[10px] mb-1">Back Squat</label>
                    <input type="number" value={userSettings.maxLifts?.squat || 225} onChange={(e) => setUserSettings({ ...userSettings, maxLifts: { ...userSettings.maxLifts, squat: e.target.value } })} className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded text-center text-slate-100" placeholder="Squat" />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[10px] mb-1">Deadlift</label>
                    <input type="number" value={userSettings.maxLifts?.deadlift || 275} onChange={(e) => setUserSettings({ ...userSettings, maxLifts: { ...userSettings.maxLifts, deadlift: e.target.value } })} className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded text-center text-slate-100" placeholder="Deadlift" />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[10px] mb-1">Overhead Press</label>
                    <input type="number" value={userSettings.maxLifts?.overheadPress || 115} onChange={(e) => setUserSettings({ ...userSettings, maxLifts: { ...userSettings.maxLifts, overheadPress: e.target.value } })} className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded text-center text-slate-100" placeholder="OHP" />
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveCustomExercise} className="border-t border-slate-800 pt-2 space-y-2">
                <label className="block text-amber-400 font-bold">➕ Create Custom Exercise</label>
                <input type="text" placeholder="Exercise Name" value={customExName} onChange={(e) => setCustomExName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded text-slate-100" required />
                <div className="grid grid-cols-3 gap-1">
                  <select value={customExTarget} onChange={(e) => setCustomExTarget(e.target.value)} className="bg-slate-950 border border-slate-700 p-1 rounded text-slate-200 text-[10px]">
                    <option value="chest">Chest</option>
                    <option value="lats">Lats</option>
                    <option value="upper back">Upper Back</option>
                    <option value="shoulders">Shoulders</option>
                    <option value="biceps">Biceps</option>
                    <option value="triceps">Triceps</option>
                    <option value="quads">Quads</option>
                    <option value="hamstrings">Hamstrings</option>
                    <option value="glutes">Glutes</option>
                    <option value="calves">Calves</option>
                    <option value="abs">Abs</option>
                  </select>
                  <select value={customExEquipment} onChange={(e) => setCustomExEquipment(e.target.value)} className="bg-slate-950 border border-slate-700 p-1 rounded text-slate-200 text-[10px]">
                    <option value="barbell">Barbell</option>
                    <option value="dumbbell">Dumbbell</option>
                    <option value="cable">Cable</option>
                    <option value="body weight">Body Weight</option>
                    <option value="smith machine">Smith Machine</option>
                    <option value="kettlebell">Kettlebell</option>
                    <option value="band">Band</option>
                  </select>
                  <select value={customExPattern} onChange={(e) => setCustomExPattern(e.target.value)} className="bg-slate-950 border border-slate-700 p-1 rounded text-slate-200 text-[10px]">
                    <option value="horizontal push">Horiz Push</option>
                    <option value="horizontal pull">Horiz Pull</option>
                    <option value="vertical push">Vert Push</option>
                    <option value="vertical pull">Vert Pull</option>
                    <option value="squat">Squat</option>
                    <option value="hinge">Hinge</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs py-1.5 rounded border border-slate-700">
                  SAVE EXERCISE
                </button>
              </form>
            </div>

            <button onClick={() => setShowSettingsModal(false)} className="w-full bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded">
              SAVE SETTINGS
            </button>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-sm w-full rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-bold text-amber-400">{isSignUpMode ? "Create Account" : "User Login"}</h3>
            {authError && <p className="text-xs text-rose-400">{authError}</p>}
            <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
              <input type="email" placeholder="Email Address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-100" required />
              <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-100" required />
              <button type="submit" className="w-full bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded">
                {isSignUpMode ? "CREATE ACCOUNT" : "LOG IN"}
              </button>
            </form>
            <button onClick={() => setIsSignUpMode(!isSignUpMode)} className="text-xs text-slate-400 hover:underline w-full text-center">
              {isSignUpMode ? "Already have an account? Log In" : "Need an account? Sign Up"}
            </button>
          </div>
        </div>
      )}

      {showSearchPickerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-bold text-cyan-400">Select Exercise for Slot</h3>
            <input type="text" placeholder="Search exercises..." value={pickerSearchQuery} onChange={(e) => setPickerSearchQuery(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-xs text-slate-100" />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {[...EXERCISES_JSON, ...customExercises]
                .filter((ex) => ex.name.toLowerCase().includes(pickerSearchQuery.toLowerCase()))
                .map((ex) => (
                  <button key={ex.id} onClick={() => assignExerciseToSlot(ex)} className="w-full text-left p-2 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-xs text-slate-200 flex justify-between">
                    <span>{ex.name}</span>
                    <span className="text-[10px] text-slate-500">{ex.equipment}</span>
                  </button>
                ))}
            </div>
            <button onClick={() => setShowSearchPickerModal(false)} className="w-full bg-slate-800 text-slate-400 text-xs py-1.5 rounded">CANCEL</button>
          </div>
        </div>
      )}
    </div>
  );
}
