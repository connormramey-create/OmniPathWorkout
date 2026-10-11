import React, { useState, useEffect } from 'react';
import { auth, db } from './config/firebase';
import exercisesData from './data/exercises.json';
import injuryData from './data/injuries.json';
import { 
  generateWorkoutSession, 
  auditWorkoutBalance, 
  generateTargetedMobility, 
  CALISTHENICS_SKILL_TREES, 
  calculateProgressionSetTargets, 
  isExerciseContraindicated,
  DEFAULT_MAX_LIFTS 
} from './services/workoutEngine';
import { 
  startRestTimer, 
  togglePauseRestTimer, 
  adjustRestTimer, 
  stopRestTimer, 
  playRestTimerFinishSound 
} from './services/timerEngine';
import { exportHistoryToCSV, getPlanStorageKey } from './services/dbService';

export default function App() {
  const [activeTab, setActiveTab] = useState('generator');
  const [currentUser, setCurrentUser] = useState(null);
  
  // Settings State
  const [userSettings, setUserSettings] = useState(() => {
    const saved = localStorage.getItem('gymbro_settings');
    return saved ? JSON.parse(saved) : {
      workoutStyle: "standard",
      selectedInjury: "none",
      progressionScheme: "linear",
      split: "upper_lower",
      duration: 45,
      restTime: 60,
      equipment: ["barbell", "dumbbell", "cable", "body weight"],
      supersets: false,
      maxLifts: DEFAULT_MAX_LIFTS
    };
  });

  // Data Stores
  const [exerciseHistory, setExerciseHistory] = useState(() => JSON.parse(localStorage.getItem('gymbro_exercise_history') || '{}'));
  const [workoutHistory, setWorkoutHistory] = useState(() => JSON.parse(localStorage.getItem('gymbro_history') || '[]'));
  const [customExercises, setCustomExercises] = useState(() => JSON.parse(localStorage.getItem('gymbro_custom_exercises') || '[]'));
  const [calisthenicsSkills, setCalisthenicsSkills] = useState(() => JSON.parse(localStorage.getItem('gymbro_calisthenics_skills') || ["Push-Up", "Australian Inverted Row", "Air Squat"]));

  // UI Modals & Active State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [generatedSession, setGeneratedSession] = useState(null);
  const [activeWorkout, setActiveWorkout] = useState(() => JSON.parse(localStorage.getItem('gymbro_active_session') || 'null'));

  // Timer State
  const [restSeconds, setRestSeconds] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  // Sync state changes locally
  useEffect(() => { localStorage.setItem('gymbro_settings', JSON.stringify(userSettings)); }, [userSettings]);
  useEffect(() => { localStorage.setItem('gymbro_exercise_history', JSON.stringify(exerciseHistory)); }, [exerciseHistory]);
  useEffect(() => { localStorage.setItem('gymbro_history', JSON.stringify(workoutHistory)); }, [workoutHistory]);
  useEffect(() => { localStorage.setItem('gymbro_custom_exercises', JSON.stringify(customExercises)); }, [customExercises]);
  useEffect(() => { localStorage.setItem('gymbro_calisthenics_skills', JSON.stringify(calisthenicsSkills)); }, [calisthenicsSkills]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
        db.ref(`users/${user.uid}`).on('value', (snapshot) => {
          const data = snapshot.val();
          if (data) {
            if (data.settings) setUserSettings(data.settings);
            if (data.history) setWorkoutHistory(data.history);
            if (data.exercise_history) setExerciseHistory(data.exercise_history);
            if (data.custom_exercises) setCustomExercises(data.custom_exercises);
            if (data.calisthenics_skills) setCalisthenicsSkills(data.calisthenics_skills);
          }
        });
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const triggerRestTimer = () => {
    const initialSeconds = parseInt(userSettings.restTime || 60, 10);
    setRestSeconds(initialSeconds);
    setIsTimerActive(true);
    setIsTimerPaused(false);

    startRestTimer(
      initialSeconds,
      (remaining) => setRestSeconds(remaining),
      () => setIsTimerActive(false)
    );
  };

  const handleAdjustTimer = (secondsToAdd) => {
    const newTime = adjustRestTimer(restSeconds, secondsToAdd);
    setRestSeconds(newTime);
    if (isTimerActive && !isTimerPaused) {
      startRestTimer(
        newTime,
        (remaining) => setRestSeconds(remaining),
        () => setIsTimerActive(false)
      );
    }
  };

  const handleTogglePauseTimer = () => {
    const newPauseState = togglePauseRestTimer(
      isTimerPaused,
      restSeconds,
      (remaining) => setRestSeconds(remaining),
      () => setIsTimerActive(false)
    );
    setIsTimerPaused(newPauseState);
  };

  const handleSkipTimer = () => {
    stopRestTimer();
    setIsTimerActive(false);
    setRestSeconds(0);
  };

  const handleGenerateSession = () => {
    const session = generateWorkoutSession({
      style: userSettings.workoutStyle,
      split: userSettings.split,
      duration: userSettings.duration,
      equipment: userSettings.equipment,
      injuryId: userSettings.selectedInjury,
      supersets: userSettings.supersets,
      calisthenicsSkills,
      customExercises
    });
    setGeneratedSession(session);
  };

  const handleStartSession = (session) => {
    const logs = session.exercises.map(ex => {
      const exKey = ex.id || ex.name;
      const historyRec = exerciseHistory[exKey];
      const sets = [];
      for (let i = 0; i < 3; i++) {
        const target = calculateProgressionSetTargets(ex, userSettings.progressionScheme, session.weekNum || 1, i, userSettings.workoutStyle, userSettings.maxLifts);
        sets.push({
          reps: target.reps,
          weight: historyRec?.lastWeight || target.weight,
          completed: false,
          label: target.label
        });
      }
      return { id: exKey, name: ex.name, target: ex.target, sets };
    });

    const activeObj = { ...session, startTime: new Date().toISOString(), logs };
    setActiveWorkout(activeObj);
    localStorage.setItem('gymbro_active_session', JSON.stringify(activeObj));
  };

  const handleToggleSetComplete = (exIdx, setIdx, isChecked) => {
    if (!activeWorkout) return;
    const updated = { ...activeWorkout };
    updated.logs[exIdx].sets[setIdx].completed = isChecked;
    setActiveWorkout(updated);
    localStorage.setItem('gymbro_active_session', JSON.stringify(updated));
    if (isChecked) triggerRestTimer();
  };

  const handleFinishWorkout = () => {
    if (!activeWorkout) return;
    let totalSessionVolume = 0;
    let totalCompletedSets = 0;
    const updatedExHistory = { ...exerciseHistory };

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

      updatedExHistory[exKey] = {
        lastWeight: maxWeight || ex.sets[0]?.weight || 0,
        lastReps: maxReps || ex.sets[0]?.reps || 0,
        lastUpdated: new Date().toLocaleDateString()
      };

      return { name: ex.name, sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps })), exerciseVolume: exVolume };
    });

    setExerciseHistory(updatedExHistory);
    const historyEntry = {
      id: `log_${Date.now()}`,
      title: activeWorkout.title,
      date: new Date().toLocaleDateString(),
      exerciseCount: activeWorkout.logs.length,
      totalCompletedSets,
      totalVolume: totalSessionVolume,
      exercises: exerciseBreakdowns
    };

    setWorkoutHistory(prev => [historyEntry, ...prev]);
    setActiveWorkout(null);
    localStorage.removeItem('gymbro_active_session');
    stopRestTimer();
    setIsTimerActive(false);
    alert(`Workout Logged! Total Volume Lifted: ${totalSessionVolume.toLocaleString()} lbs`);
  };

  const formattedTimer = `${Math.floor(restSeconds / 60).toString().padStart(2, '0')}:${(restSeconds % 60).toString().padStart(2, '0')}`;

  return (
    <div className="max-w-md mx-auto p-4 pb-28 text-slate-100 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
        <div>
          <h1 className="text-xl font-black text-amber-400 tracking-wider">OMNIPATH WORKOUT</h1>
          <p className="text-xs text-slate-400 font-bold">{userSettings.workoutStyle.toUpperCase()} TRACKER</p>
        </div>
        <button onClick={() => setIsSettingsOpen(true)} className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded font-bold hover:bg-slate-700">
          ⚙️ SETTINGS
        </button>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 mb-6 text-xs font-bold">
        <button onClick={() => setActiveTab('generator')} className={`flex-1 py-2 rounded ${activeTab === 'generator' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'}`}>GENERATOR</button>
        {userSettings.workoutStyle === 'calisthenics' && (
          <button onClick={() => setActiveTab('pathways')} className={`flex-1 py-2 rounded ${activeTab === 'pathways' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'}`}>PATHWAYS</button>
        )}
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 rounded ${activeTab === 'history' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'}`}>LOG</button>
      </nav>

      {/* Generator Tab */}
      {activeTab === 'generator' && (
        <div className="space-y-4">
          <button onClick={handleGenerateSession} className="w-full py-3 bg-amber-400 text-slate-950 font-black rounded-lg shadow hover:bg-amber-300">
            ⚡ GENERATE WORKOUT
          </button>

          {generatedSession && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-base font-bold text-amber-400">{generatedSession.title}</h3>
                <p className="text-xs text-slate-400">{userSettings.duration} Mins | Style: {userSettings.workoutStyle.toUpperCase()} | Scheme: {userSettings.progressionScheme.toUpperCase()}</p>
              </div>

              <div className="space-y-2">
                {generatedSession.exercises.map((ex, idx) => (
                  <div key={idx} className="bg-slate-950 p-3 rounded border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-200">{ex.name}</span>
                      <p className="text-slate-400 text-[10px]">Target: {ex.target} | Equip: {ex.equipment}</p>
                    </div>
                    {ex.supersetGroup && <span className="bg-amber-400/10 text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded text-[10px] font-bold">{ex.supersetGroup}</span>}
                  </div>
                ))}
              </div>

              <button onClick={() => handleStartSession(generatedSession)} className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded hover:bg-emerald-400">
                ▶ START ACTIVE WORKOUT
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pathways Tab */}
      {activeTab === 'pathways' && userSettings.workoutStyle === 'calisthenics' && (
        <div className="space-y-4 text-xs">
          {Object.entries(CALISTHENICS_SKILL_TREES).map(([group, skills]) => (
            <div key={group} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h4 className="font-bold text-amber-400 mb-2 uppercase">{group} PATHWAY</h4>
              <div className="space-y-2">
                {skills.map((s) => (
                  <label key={s.name} className="flex items-center gap-2 cursor-pointer bg-slate-950 p-2 rounded border border-slate-800">
                    <input 
                      type="checkbox" 
                      checked={calisthenicsSkills.includes(s.name)} 
                      onChange={() => {
                        const updated = calisthenicsSkills.includes(s.name) ? calisthenicsSkills.filter(x => x !== s.name) : [...calisthenicsSkills, s.name];
                        setCalisthenicsSkills(updated);
                      }} 
                    />
                    <span><strong>L{s.level}: {s.name}</strong> ({s.reps})</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History Log Tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <button onClick={() => exportHistoryToCSV(workoutHistory)} className="w-full py-2 bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs rounded">
            📥 EXPORT CSV LOG
          </button>
          <div className="space-y-2">
            {workoutHistory.map((item) => (
              <div key={item.id} className="bg-slate-900 border-l-4 border-amber-400 p-3 rounded text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-200">{item.title}</span>
                  <span className="bg-amber-400/20 text-amber-400 font-mono font-bold px-2 py-0.5 rounded">{item.totalVolume.toLocaleString()} lbs</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{item.date} • {item.exerciseCount} Exercises • {item.totalCompletedSets} Sets</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Workout Drawer / Modal */}
      {activeWorkout && (
        <div className="fixed inset-0 bg-slate-950/95 p-4 overflow-y-auto z-40 max-w-md mx-auto">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
            <h3 className="font-bold text-amber-400">{activeWorkout.title}</h3>
            <button onClick={handleFinishWorkout} className="bg-emerald-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded">
              ✓ FINISH & LOG
            </button>
          </div>

          <div className="space-y-4">
            {activeWorkout.logs.map((ex, exIdx) => {
              const historyRec = exerciseHistory[ex.id || ex.name];
              return (
                <div key={exIdx} className="bg-slate-900 border border-slate-800 rounded p-3 text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-200">{ex.name}</span>
                    {historyRec?.lastReps >= 12 && <span className="text-[10px] bg-amber-400/20 text-amber-400 font-bold px-1.5 py-0.5 rounded">🚀 +5 lbs Suggested</span>}
                  </div>
                  {historyRec && <p className="text-[10px] text-slate-400">LAST TIME: {historyRec.lastWeight} lbs × {historyRec.lastReps} reps</p>}

                  <div className="space-y-1 pt-1">
                    {ex.sets.map((s, sIdx) => (
                      <div key={sIdx} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400">Set {sIdx + 1} ({s.label})</span>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            value={s.weight} 
                            onChange={(e) => {
                              const updated = { ...activeWorkout };
                              updated.logs[exIdx].sets[sIdx].weight = parseFloat(e.target.value) || 0;
                              setActiveWorkout(updated);
                            }}
                            className="w-14 bg-slate-900 border border-slate-700 text-center rounded text-xs p-1" 
                          /> lbs
                          <input 
                            type="number" 
                            value={s.reps} 
                            onChange={(e) => {
                              const updated = { ...activeWorkout };
                              updated.logs[exIdx].sets[sIdx].reps = parseFloat(e.target.value) || 0;
                              setActiveWorkout(updated);
                            }}
                            className="w-12 bg-slate-900 border border-slate-700 text-center rounded text-xs p-1" 
                          /> reps
                        </div>
                        <label className="flex items-center gap-1 text-[10px] font-bold text-slate-300 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={s.completed} 
                            onChange={(e) => handleToggleSetComplete(exIdx, sIdx, e.target.checked)} 
                          /> DONE
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Rest Timer Bar */}
      {isTimerActive && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-amber-400 p-3 flex justify-between items-center max-w-md mx-auto z-50">
          <span className="font-mono font-bold text-lg text-amber-400">{formattedTimer}</span>
          <div className="flex gap-2 text-xs font-bold">
            <button onClick={() => handleAdjustTimer(15)} className="bg-slate-800 px-2 py-1 rounded">+15s</button>
            <button onClick={handleTogglePauseTimer} className="bg-slate-800 px-2 py-1 rounded">{isTimerPaused ? 'RESUME' : 'PAUSE'}</button>
            <button onClick={handleSkipTimer} className="bg-rose-900 text-rose-200 px-2 py-1 rounded">SKIP</button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/90 p-4 overflow-y-auto z-50 max-w-md mx-auto text-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h3 className="font-bold text-amber-400">APP SETTINGS</h3>
            <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 font-bold">✕ CLOSE</button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-slate-400 mb-1 font-bold">WORKOUT STYLE</label>
              <select value={userSettings.workoutStyle} onChange={(e) => setUserSettings({ ...userSettings, workoutStyle: e.target.value })} className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-slate-100">
                <option value="standard">Standard Lifter</option>
                <option value="powerlifter">Powerlifter</option>
                <option value="calisthenics">Calisthenics</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-bold">INJURY FILTER</label>
              <select value={userSettings.selectedInjury} onChange={(e) => setUserSettings({ ...userSettings, selectedInjury: e.target.value })} className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-slate-100">
                <option value="none">None / Healthy</option>
                <option value="shoulder_rotator_cuff">Shoulder / Rotator Cuff</option>
                <option value="lower_back">Lower Back Strain</option>
                <option value="knee_patellar">Knee Tendonitis</option>
                <option value="wrist_forearm">Wrist / Forearm</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-bold">PROGRESSION SCHEME</label>
              <select value={userSettings.progressionScheme} onChange={(e) => setUserSettings({ ...userSettings, progressionScheme: e.target.value })} className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-slate-100">
                <option value="linear">Linear Progression</option>
                <option value="five_three_one">5/3/1 Scheme</option>
                <option value="juggernaut">Juggernaut Method</option>
                <option value="conjugate">Conjugate Method</option>
              </select>
            </div>

            <div className="border-t border-slate-800 pt-2 space-y-2">
              <label className="block text-amber-400 font-bold">1RM MAX LIFTS (LBS)</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400">Bench Press</span>
                  <input type="number" value={userSettings.maxLifts.benchPress} onChange={(e) => setUserSettings({ ...userSettings, maxLifts: { ...userSettings.maxLifts, benchPress: parseFloat(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-800 p-1.5 rounded" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Back Squat</span>
                  <input type="number" value={userSettings.maxLifts.squat} onChange={(e) => setUserSettings({ ...userSettings, maxLifts: { ...userSettings.maxLifts, squat: parseFloat(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-800 p-1.5 rounded" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Deadlift</span>
                  <input type="number" value={userSettings.maxLifts.deadlift} onChange={(e) => setUserSettings({ ...userSettings, maxLifts: { ...userSettings.maxLifts, deadlift: parseFloat(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-800 p-1.5 rounded" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Overhead Press</span>
                  <input type="number" value={userSettings.maxLifts.overheadPress} onChange={(e) => setUserSettings({ ...userSettings, maxLifts: { ...userSettings.maxLifts, overheadPress: parseFloat(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-800 p-1.5 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
