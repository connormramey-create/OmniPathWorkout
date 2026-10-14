/**
 * App.jsx — holds the app's state and wires the tabs/modals together.
 *
 * Where to look when something breaks:
 *   Which exercises appear ............ services/workoutEngine.js + data/muscleGroups.json
 *   Sets / reps / weights ............. services/progression.js
 *   Warm-ups / cool-downs ............. data/warmups.json
 *   Calisthenics skill trees .......... data/calisthenicsTrees.json
 *   Rest timer & sound ................ services/timerEngine.js
 *   Saving, Firebase, public programs . services/dbService.js (+ database.rules.json)
 *   Multi-week plans .................. services/planBuilder.js
 */
import { useEffect, useRef, useState } from "react";
import { auth } from "./config/firebase";
import usePersistentState from "./hooks/usePersistentState";
import useRestTimer from "./hooks/useRestTimer";
import {
  STORAGE_KEYS, asArray, cloudFingerprint, copyPublicProgram, getPlanStorageKey, loadLocal,
  normalizePlan, publishProgram, saveLocal, saveUserData, subscribeToUserData, unpublishProgram
} from "./services/dbService";
import {
  ALL_EQUIPMENT, DEFAULT_MAX_LIFTS, DEFAULT_SETTINGS, generateWorkoutSession, normalizeSkillNames,
  prepareActiveSession, summarizeExerciseLog
} from "./services/workoutEngine";
import { getCycleWeek } from "./services/progression";
import {
  buildProgramSkeleton, buildStandardPlan, copyFirstWeekToAll, effortTypeForPlanDay, markDayCompleted, setSlotExercise
} from "./services/planBuilder";

import ActiveWorkoutModal from "./components/ActiveWorkoutModal";
import AuthModal from "./components/AuthModal";
import ExercisePickerModal from "./components/ExercisePickerModal";
import GeneratorTab from "./components/GeneratorTab";
import HistoryTab from "./components/HistoryTab";
import PathwaysTab from "./components/PathwaysTab";
import PlanTab from "./components/PlanTab";
import SettingsModal from "./components/SettingsModal";
import TimerBar from "./components/TimerBar";

const PLAN_STYLES = ["standard", "powerlifter", "calisthenics", "program_builder"];

/** Fills in any settings added in newer versions and fixes old values. */
function migrateSettings(saved) {
  const settings = { ...DEFAULT_SETTINGS, ...(saved || {}) };
  settings.maxLifts = { ...DEFAULT_MAX_LIFTS, ...(saved?.maxLifts || {}) };
  settings.calisthenicsUnlocked = normalizeSkillNames(asArray(settings.calisthenicsUnlocked));
  settings.equipment = saved?.equipment ? asArray(saved.equipment) : ALL_EQUIPMENT;
  return settings;
}

function loadPlans() {
  return Object.fromEntries(PLAN_STYLES.map((style) => [style, normalizePlan(loadLocal(getPlanStorageKey(style), null))]));
}

export default function App() {
  // ----- Saved data (localStorage, and Firebase when logged in) -----
  const [settings, setSettings] = usePersistentState(STORAGE_KEYS.settings, DEFAULT_SETTINGS, migrateSettings);
  const [history, setHistory] = usePersistentState(STORAGE_KEYS.history, [], asArray);
  const [exerciseHistory, setExerciseHistory] = usePersistentState(STORAGE_KEYS.exerciseHistory, {});
  const [customExercises, setCustomExercises] = usePersistentState(STORAGE_KEYS.customExercises, [], asArray);
  const [activeWorkout, setActiveWorkout] = usePersistentState(STORAGE_KEYS.activeSession, null);
  const [plans, setPlans] = useState(loadPlans);

  // ----- UI state -----
  const [activeTab, setActiveTab] = useState("generator");
  const [showSettings, setShowSettings] = useState(false);
  const [showActive, setShowActive] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [generatedSession, setGeneratedSession] = useState(null);
  const [shareStatus, setShareStatus] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const timer = useRestTimer({ background: !!settings.backgroundTimerAlert });
  const profile = settings.profile || "standard";
  const activePlan = plans[profile] || null;
  const builderPlan = plans.program_builder;
  const setPlanFor = (style, plan) => setPlans((prev) => ({ ...prev, [style]: plan }));

  // Save each plan to localStorage when it changes.
  useEffect(() => {
    PLAN_STYLES.forEach((style) => saveLocal(getPlanStorageKey(style), plans[style]));
  }, [plans]);

  // ----- Firebase auth + sync -----
  useEffect(() => (auth ? auth.onAuthStateChanged((user) => setCurrentUser(user || null)) : undefined), []);

  // cloudSnapshot remembers what the cloud has, so we only upload real changes.
  const cloudSnapshot = useRef({});
  const [cloudReadyUid, setCloudReadyUid] = useState(null);
  const cloudReady = !!currentUser && cloudReadyUid === currentUser.uid;

  useEffect(() => {
    if (!currentUser) return undefined;
    const uid = currentUser.uid;
    const unsubscribe = subscribeToUserData(uid, (data) => {
      const apply = (field, value, update) => {
        if (value === null || value === undefined) return;
        const fingerprint = cloudFingerprint(value);
        if (fingerprint === cloudSnapshot.current[field]) return; // echo of our own write
        cloudSnapshot.current[field] = fingerprint;
        update(value);
      };
      apply("settings", data.settings, (v) => setSettings(migrateSettings(v)));
      apply("history", data.history, (v) => setHistory(asArray(v)));
      apply("exerciseHistory", data.exercise_history, setExerciseHistory);
      apply("customExercises", data.custom_exercises, (v) => setCustomExercises(asArray(v)));
      apply("plans", data.plans, (v) => setPlans((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.entries(v).map(([style, plan]) => [style, normalizePlan(plan)]))
      })));
      setCloudReadyUid(uid);
    });
    return () => { unsubscribe(); cloudSnapshot.current = {}; };
  }, [currentUser, setSettings, setHistory, setExerciseHistory, setCustomExercises]);

  // Upload local changes (debounced) once the first cloud snapshot has arrived.
  useEffect(() => {
    if (!cloudReady) return undefined;
    const timeout = setTimeout(() => {
      const fields = { settings, history, exerciseHistory, customExercises, plans };
      const changed = {};
      Object.entries(fields).forEach(([field, value]) => {
        const fingerprint = cloudFingerprint(value);
        if (fingerprint !== cloudSnapshot.current[field]) {
          changed[field] = value;
          cloudSnapshot.current[field] = fingerprint;
        }
      });
      if (Object.keys(changed).length > 0) saveUserData(currentUser.uid, changed);
    }, 600);
    return () => clearTimeout(timeout);
  }, [cloudReady, currentUser, settings, history, exerciseHistory, customExercises, plans]);

  // Keep the public copy of a shared Program Builder plan up to date.
  useEffect(() => {
    if (!currentUser || !builderPlan?.isPublic || !builderPlan.publicId) return undefined;
    const timeout = setTimeout(() => {
      publishProgram(currentUser, builderPlan, { title: builderPlan.title, authorName: builderPlan.authorName })
        .catch((err) => console.error("[community] auto-update failed:", err));
    }, 1500);
    return () => clearTimeout(timeout);
  }, [currentUser, builderPlan]);

  // ----- Generator & workouts -----
  const cycleWeek = getCycleWeek(settings);

  const handleGenerate = () => {
    setGeneratedSession(generateWorkoutSession(settings, customExercises, { history, weekNum: cycleWeek }));
  };

  const startActiveWorkout = (session, extra = {}) => {
    if (activeWorkout && !confirm(`You have an unfinished workout (${activeWorkout.title}). Replace it?`)) return;
    const active = prepareActiveSession(session, settings, exerciseHistory, extra);
    setActiveWorkout({ ...active, ...extra });
    setShowActive(true);
  };

  const startPlanDay = (day, weekNum) => {
    if (day.type === "rest") return;
    const base = { history, weekNum };
    const ref = { planDayRef: day.id, planStyle: profile };

    if (activePlan.type === "program_builder") {
      const session = generateWorkoutSession(settings, customExercises, { ...base, fixedExercises: day.exercises });
      session.title = `${activePlan.title || "Program"} · Week ${weekNum} · ${day.title}`;
      startActiveWorkout(session, { ...ref, restTime: activePlan.restTime, progressionRate: activePlan.progressionRate });
      return;
    }
    const effortType = effortTypeForPlanDay(activePlan, weekNum, day.id);
    const session = generateWorkoutSession(settings, customExercises, { ...base, splitOverride: day.type, effortType });
    session.title = `Week ${weekNum} · ${day.title}`;
    startActiveWorkout(session, ref);
  };

  const updateSet = (exIdx, setIdx, patch) => {
    setActiveWorkout((prev) => ({
      ...prev,
      logs: prev.logs.map((log, i) => (i !== exIdx ? log : {
        ...log,
        sets: log.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch }))
      }))
    }));
  };

  const toggleSetComplete = (exIdx, setIdx) => {
    const nowComplete = !activeWorkout.logs[exIdx].sets[setIdx].completed;
    updateSet(exIdx, setIdx, { completed: nowComplete });
    if (nowComplete && settings.autoStartTimer) timer.start(activeWorkout.restTime || settings.restTime || 60);
  };

  const updateSetValue = (exIdx, setIdx, field, value) => {
    updateSet(exIdx, setIdx, { [field]: value === "" ? "" : Number(value) });
  };

  const finishWorkout = () => {
    let totalVolume = 0, totalSets = 0, totalReps = 0;
    const newExerciseHistory = { ...exerciseHistory };
    activeWorkout.logs.forEach((log) => {
      log.sets.filter((s) => s.completed).forEach((s) => {
        totalVolume += (Number(s.weight) || 0) * (Number(s.reps) || 0);
        totalReps += Number(s.reps) || 0;
        totalSets++;
      });
      const summary = summarizeExerciseLog(log);
      if (summary) newExerciseHistory[log.id] = summary; // skipped exercises keep their old record
    });

    const entry = {
      id: `log_${Date.now()}`,
      title: activeWorkout.title,
      date: new Date().toLocaleDateString(),
      isoDate: new Date().toISOString(),
      split: activeWorkout.split,
      region: activeWorkout.region,
      effortType: activeWorkout.effortType,
      exerciseCount: activeWorkout.logs.length,
      totalCompletedSets: totalSets,
      totalVolume,
      totalReps,
      logs: activeWorkout.logs
    };

    setHistory([entry, ...history]);
    setExerciseHistory(newExerciseHistory);
    if (activeWorkout.planDayRef && plans[activeWorkout.planStyle]) {
      setPlanFor(activeWorkout.planStyle, markDayCompleted(plans[activeWorkout.planStyle], activeWorkout.planDayRef));
    }
    setActiveWorkout(null);
    setShowActive(false);
    timer.stop();
    alert(totalVolume > 0 ? `Workout logged! Total volume: ${totalVolume.toLocaleString()} lbs` : `Workout logged! ${totalReps} total reps`);
  };

  const discardWorkout = () => {
    if (!confirm("Discard this workout without logging it?")) return;
    setActiveWorkout(null);
    setShowActive(false);
    timer.stop();
  };

  // ----- Settings -----
  const toggleSkill = (name) => {
    const current = settings.calisthenicsUnlocked || [];
    setSettings({
      ...settings,
      calisthenicsUnlocked: current.includes(name) ? current.filter((n) => n !== name) : [...current, name]
    });
  };
  const restartCycle = () => setSettings({ ...settings, cycleStartDate: new Date().toISOString() });
  const saveCustomExercise = (exercise) => {
    setCustomExercises([...customExercises, { ...exercise, id: `custom_${Date.now()}` }]);
    alert("Custom exercise added!");
  };

  // ----- Program Builder & sharing -----
  const publishPlan = async (plan, authorName) => {
    const name = (authorName || "").trim();
    if (!currentUser) { setShareStatus("Log in to share programs."); return plan; }
    if (!name) { setShareStatus("Enter a public display name first."); return plan; }
    try {
      if (currentUser.displayName !== name) await currentUser.updateProfile({ displayName: name });
      const { publicId, publishedAt } = await publishProgram(currentUser, plan, { title: plan.title, authorName: name });
      setShareStatus("✓ Published. Other users can now find it in Community Programs.");
      return { ...plan, isPublic: true, publicId, publishedAt, authorName: name };
    } catch (err) {
      console.error("[community] publish failed:", err);
      setShareStatus(`Couldn't publish: ${err.message}. Check the database rules are published (see README).`);
      return plan;
    }
  };

  const handleSetPublic = async (makePublic, authorName) => {
    if (makePublic) {
      setPlanFor("program_builder", await publishPlan(builderPlan, authorName));
      return;
    }
    try {
      await unpublishProgram(builderPlan.publicId);
      setShareStatus("Program is private again.");
    } catch (err) {
      console.error("[community] unpublish failed:", err);
      setShareStatus(`Couldn't make private: ${err.message}`);
    }
    setPlanFor("program_builder", { ...builderPlan, isPublic: false, publicId: null });
  };

  const handleBuildProgram = async (config, authorName) => {
    if (builderPlan?.publicId) await unpublishProgram(builderPlan.publicId).catch(() => {});
    let plan = buildProgramSkeleton(config);
    setShareStatus("");
    if (config.makePublic) plan = await publishPlan(plan, authorName);
    setPlanFor("program_builder", plan);
  };

  const assignSlot = (exercise) => {
    const { weekNum, dayNum, slotIdx } = pickerSlot;
    setPlanFor("program_builder", setSlotExercise(builderPlan, weekNum, dayNum, slotIdx, exercise));
    setPickerSlot(null);
  };

  // ----- Render -----
  const tabs = [
    ["generator", "QUICK GENERATOR"],
    ["plan", "PROGRAM PLANNER"],
    ...(profile === "calisthenics" ? [["pathways", "PROGRESSION PATHWAYS"]] : []),
    ["history", "PROGRESS LOG"]
  ];
  const tab = tabs.some(([id]) => id === activeTab) ? activeTab : "generator";

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 p-4 pb-24 font-sans theme-${profile}`}>
      <header className="flex justify-between items-center border-b border-slate-800 pb-3 mb-6 max-w-4xl mx-auto gap-2">
        <div>
          <h1 className="text-2xl font-black tracking-wider text-amber-400">OmniPathWorkout</h1>
          <div className="text-xs tracking-widest text-slate-400 font-semibold uppercase">{profile.replace("_", " ")} WORKOUT STYLE</div>
        </div>
        <div className="flex gap-2 items-center">
          {currentUser ? (
            <button onClick={() => auth.signOut()} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300">
              {currentUser.displayName || currentUser.email?.split("@")[0]} (Logout)
            </button>
          ) : (
            <button onClick={() => setShowAuth(true)} className="text-xs bg-amber-500 hover:bg-amber-600 font-bold px-3 py-1.5 rounded text-slate-950">
              LOGIN
            </button>
          )}
          <button onClick={() => setShowSettings(true)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded border border-slate-700">
            SETTINGS
          </button>
        </div>
      </header>

      <nav className="flex gap-2 border-b border-slate-800 mb-6 max-w-4xl mx-auto overflow-x-auto">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`px-4 py-2 text-xs font-bold rounded-t border-b-2 whitespace-nowrap ${tab === id ? "border-amber-400 text-amber-400 bg-slate-900" : "border-transparent text-slate-400"}`}>
            {label}
          </button>
        ))}
      </nav>

      <main className="max-w-4xl mx-auto space-y-6">
        {activeWorkout && !showActive && (
          <button onClick={() => setShowActive(true)} className="w-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold py-2 rounded">
            ▶ RESUME ACTIVE WORKOUT: {activeWorkout.title}
          </button>
        )}

        {tab === "generator" && (
          <GeneratorTab
            settings={settings}
            cycleWeek={cycleWeek}
            session={generatedSession}
            onGenerate={handleGenerate}
            onStart={(session) => startActiveWorkout({ ...session, weekNum: cycleWeek })}
            onRestartCycle={restartCycle}
          />
        )}
        {tab === "plan" && (
          <PlanTab
            settings={settings}
            plan={activePlan}
            currentUser={currentUser}
            customExercises={customExercises}
            shareStatus={shareStatus}
            onBuildStandard={(months) => setPlanFor(profile, buildStandardPlan(settings.split, months))}
            onBuildProgram={handleBuildProgram}
            onPickSlot={setPickerSlot}
            onStartDay={startPlanDay}
            onCopyFirstWeek={() => setPlanFor("program_builder", copyFirstWeekToAll(builderPlan))}
            onSetPublic={handleSetPublic}
            onCopyCommunityProgram={(program) => { setPlanFor("program_builder", copyPublicProgram(program)); setShareStatus(""); }}
          />
        )}
        {tab === "pathways" && <PathwaysTab mastered={settings.calisthenicsUnlocked} onToggle={toggleSkill} />}
        {tab === "history" && <HistoryTab history={history} />}
      </main>

      <TimerBar timer={timer} />

      {showActive && activeWorkout && (
        <ActiveWorkoutModal
          workout={activeWorkout}
          timer={timer}
          onToggleSet={toggleSetComplete}
          onUpdateSet={updateSetValue}
          onMinimize={() => setShowActive(false)}
          onFinish={finishWorkout}
          onDiscard={discardWorkout}
        />
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onRestartCycle={restartCycle}
          onSaveCustomExercise={saveCustomExercise}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {pickerSlot && (
        <ExercisePickerModal
          customExercises={customExercises}
          onPick={assignSlot}
          onClear={() => assignSlot(null)}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}
