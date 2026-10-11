import React, { useState, useEffect } from 'react';
import { auth } from './config/firebase';
import { generateWorkoutSession, CALISTHENICS_SKILL_TREES } from './services/workoutEngine';
import { startRestTimer, togglePauseRestTimer, adjustRestTimer, stopRestTimer } from './services/timerEngine';
import { syncUserDataFromCloud, saveUserDataToCloud, exportHistoryToCSV, getPlanStorageKey } from './services/dbService';

export default function App() {
  const [activeTab, setActiveTab] = useState('generator');
  const [currentUser, setCurrentUser] = useState(null);
  const [workoutStyle, setWorkoutStyle] = useState('standard');
  const [activeSession, setActiveSession] = useState(null);
  const [timerDisplay, setTimerDisplay] = useState('00:00');
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState(null);
  const [calisthenicsSkills, setCalisthenicsSkills] = useState(["Push-Up", "Australian Inverted Row", "Air Squat"]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
        syncUserDataFromCloud(user.uid, (data) => {
          if (data.calisthenics_skills) setCalisthenicsSkills(data.calisthenics_skills);
          if (data.settings?.workoutStyle) setWorkoutStyle(data.settings.workoutStyle);
        });
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGenerateWorkout = () => {
    const session = generateWorkoutSession();
    setGeneratedWorkout(session);
  };

  const handleStartWorkout = () => {
    if (!generatedWorkout) return;
    setActiveSession(generatedWorkout);
    localStorage.setItem('gymbro_active_session', JSON.stringify(generatedWorkout));
  };

  const handleToggleSkill = (skillName) => {
    const updated = calisthenicsSkills.includes(skillName)
      ? calisthenicsSkills.filter(s => s !== skillName)
      : [...calisthenicsSkills, skillName];
    setCalisthenicsSkills(updated);
    localStorage.setItem('gymbro_calisthenics_skills', JSON.stringify(updated));
    if (currentUser) {
      saveUserDataToCloud(currentUser.uid, { calisthenicsSkills: updated }, workoutStyle);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-24">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
        <div>
          <h1 className="text-xl font-black text-amber-400 tracking-wider">OMNIPATH WORKOUT</h1>
          <p className="text-xs text-slate-400 font-bold">{workoutStyle.toUpperCase()} TRACKER</p>
        </div>
        <button className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded font-bold hover:bg-slate-700">
          ⚙️ SETTINGS
        </button>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 mb-6 text-xs font-bold">
        <button 
          onClick={() => setActiveTab('generator')} 
          className={`flex-1 py-2 rounded text-center ${activeTab === 'generator' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'}`}>
          GENERATOR
        </button>
        <button 
          onClick={() => setActiveTab('plan')} 
          className={`flex-1 py-2 rounded text-center ${activeTab === 'plan' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'}`}>
          PLAN
        </button>
        {workoutStyle === 'calisthenics' && (
          <button 
            onClick={() => setActiveTab('pathways')} 
            className={`flex-1 py-2 rounded text-center ${activeTab === 'pathways' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'}`}>
            PATHWAYS
          </button>
        )}
        <button 
          onClick={() => setActiveTab('history')} 
          className={`flex-1 py-2 rounded text-center ${activeTab === 'history' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'}`}>
          LOG
        </button>
      </nav>

      {/* Main Tab Content */}
      <main>
        {activeTab === 'generator' && (
          <div className="space-y-4">
            <button 
              onClick={handleGenerateWorkout} 
              className="w-full py-3 bg-amber-400 text-slate-950 font-black rounded-lg shadow hover:bg-amber-300">
              ⚡ GENERATE WORKOUT
            </button>

            {generatedWorkout && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                <h3 className="text-base font-bold text-amber-400">{generatedWorkout.title}</h3>
                <div className="space-y-2">
                  {generatedWorkout.exercises.map((ex, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded border border-slate-800 flex justify-between items-center text-xs">
                      <span className="font-bold">{ex.name}</span>
                      <span className="text-slate-400">{ex.equipment}</span>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleStartWorkout} 
                  className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded hover:bg-emerald-400">
                  ▶ START ACTIVE WORKOUT
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pathways' && (
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
                        onChange={() => handleToggleSkill(s.name)} 
                      />
                      <span><strong>L{s.level}: {s.name}</strong> ({s.reps})</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            <button 
              onClick={() => exportHistoryToCSV(JSON.parse(localStorage.getItem('gymbro_history') || '[]'))}
              className="w-full py-2 bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs rounded">
              📥 EXPORT CSV LOG
            </button>
          </div>
        )}
      </main>

      {/* Rest Timer Floating Bar */}
      {isTimerActive && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-amber-400 p-3 flex justify-between items-center max-w-md mx-auto">
          <span className="font-mono font-bold text-lg text-amber-400">{timerDisplay}</span>
          <div className="flex gap-2 text-xs font-bold">
            <button onClick={() => adjustRestTimer(30, setTimerDisplay)} className="bg-slate-800 px-2 py-1 rounded">+30s</button>
            <button onClick={togglePauseRestTimer} className="bg-slate-800 px-2 py-1 rounded">PAUSE</button>
            <button onClick={() => stopRestTimer()} className="bg-rose-900 text-rose-200 px-2 py-1 rounded">SKIP</button>
          </div>
        </div>
      )}
    </div>
  );
}
