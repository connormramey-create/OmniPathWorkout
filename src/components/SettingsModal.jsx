import { useState } from "react";
import { ALL_EQUIPMENT, INJURY_OPTIONS } from "../services/workoutEngine";
import { PROGRESSION_SCHEMES } from "../services/progression";

const PROFILES = {
  standard: "Standard Hypertrophy",
  powerlifter: "Powerlifter Heavy Compounds",
  calisthenics: "Calisthenics Bodyweight Flow",
  program_builder: "Program Builder Custom Wizard"
};

const SPLITS = {
  upper_lower: "Upper / Lower (alternates each workout)",
  upper: "Upper Body Only",
  lower: "Lower Body Only",
  ppl: "Push / Pull / Legs (rotates each workout)",
  ppl_push: "Push Only (PPL)",
  ppl_pull: "Pull Only (PPL)",
  ppl_legs: "Legs Only (PPL)",
  full_body: "Full Body"
};

const MAX_LIFT_FIELDS = [
  ["benchPress", "Bench Press"],
  ["squat", "Back Squat"],
  ["deadlift", "Deadlift"],
  ["overheadPress", "Overhead Press"]
];

const CUSTOM_TARGETS = ["pectorals", "upper chest", "lats", "upper back", "traps", "shoulders", "side delts", "rear delts", "biceps", "triceps", "forearms", "quads", "hamstrings", "glutes", "calves", "abs", "obliques", "lower back"];
const CUSTOM_PATTERNS = ["horizontal push", "horizontal pull", "vertical push", "vertical pull", "squat", "hinge", "elbow flexion", "elbow extension", "anti-extension", "rotation"];

const inputClass = "w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200";

export default function SettingsModal({ settings, onChange, onRestartCycle, onSaveCustomExercise, onClose }) {
  const [custom, setCustom] = useState({ name: "", target: "pectorals", equipment: "barbell", movement_pattern: "horizontal push" });
  const set = (patch) => onChange({ ...settings, ...patch });
  const showScheme = !["calisthenics", "program_builder"].includes(settings.profile);

  const toggleEquipment = (item) => {
    const current = settings.equipment || [];
    set({ equipment: current.includes(item) ? current.filter((e) => e !== item) : [...current, item] });
  };

  const submitCustom = (e) => {
    e.preventDefault();
    if (!custom.name.trim()) return;
    onSaveCustomExercise({ ...custom, name: custom.name.trim(), difficulty: "beginner" });
    setCustom({ ...custom, name: "" });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-amber-400 border-b border-slate-800 pb-2">Settings & Configuration</h3>

        <div className="space-y-3 text-xs">
          <Field label="Workout Style (Profile Preset)">
            <select value={settings.profile} onChange={(e) => set({ profile: e.target.value })} className={inputClass}>
              {Object.entries(PROFILES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>

          <Field label="Session Duration Target">
            <select value={settings.duration} onChange={(e) => set({ duration: parseInt(e.target.value, 10) })} className={inputClass}>
              <option value={30}>30 Minutes</option>
              <option value={45}>45 Minutes</option>
              <option value={60}>60 Minutes</option>
              <option value={90}>90+ Minutes</option>
            </select>
          </Field>

          {showScheme && (
            <Field label="Progression Scheme">
              <select
                value={settings.progressionScheme || "linear"}
                onChange={(e) => set({ progressionScheme: e.target.value, cycleStartDate: new Date().toISOString() })}
                className={inputClass}
              >
                {Object.entries(PROGRESSION_SCHEMES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Applies to barbell main lifts. Other exercises add reps, then +5 lbs at the top of the range.
                {settings.progressionScheme !== "linear" && (
                  <> <button type="button" onClick={onRestartCycle} className="underline">Restart cycle at week 1</button></>
                )}
              </p>
            </Field>
          )}

          <Field label="Workout Split Focus">
            <select value={settings.split} onChange={(e) => set({ split: e.target.value })} className={inputClass}>
              {Object.entries(SPLITS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>

          <div className="border-t border-slate-800 pt-2 space-y-2">
            <label className="block text-amber-400 font-bold">Rest Timer</label>
            <Field label="Default rest (seconds)">
              <input type="number" min="5" value={settings.restTime || 60} onChange={(e) => set({ restTime: parseInt(e.target.value, 10) || 60 })} className={inputClass} />
            </Field>
            <Toggle checked={!!settings.autoStartTimer} onChange={(v) => set({ autoStartTimer: v })} label="Start the timer automatically when I tick a set" />
            <Toggle checked={!!settings.backgroundTimerAlert} onChange={(v) => set({ backgroundTimerAlert: v })} label="Background timer alert" />
            <p className="text-[10px] text-slate-500">
              On: the beep plays even if you switch apps or lock your phone, and on iPhone it plays even on silent.
              Your phone treats it like music, so it may pause Spotify/Apple Music during rest.
              Off: music keeps playing, but the beep only plays while this tab is open (and iPhone silent mode mutes it).
            </p>
          </div>

          <Field label="Injury Contraindication Filter">
            <select value={settings.selectedInjury || "none"} onChange={(e) => set({ selectedInjury: e.target.value })} className={inputClass}>
              {INJURY_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>

          {settings.profile !== "calisthenics" && (
            <div className="border-t border-slate-800 pt-2">
              <label className="block text-amber-400 font-bold mb-1">Available Equipment</label>
              <div className="grid grid-cols-2 gap-1">
                {ALL_EQUIPMENT.map((item) => (
                  <label key={item} className="flex items-center gap-2 text-slate-300 capitalize">
                    <input type="checkbox" checked={(settings.equipment || []).includes(item)} onChange={() => toggleEquipment(item)} className="accent-amber-400" />
                    {item}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-slate-800 pt-2 space-y-2">
            <label className="block text-amber-400 font-bold">1RM Max Lifts Baseline (lbs)</label>
            <div className="grid grid-cols-2 gap-2">
              {MAX_LIFT_FIELDS.map(([key, label]) => (
                <div key={key}>
                  <label className="block text-slate-500 text-[10px] mb-1">{label}</label>
                  <input
                    type="number" value={settings.maxLifts?.[key] ?? ""}
                    onChange={(e) => set({ maxLifts: { ...settings.maxLifts, [key]: e.target.value === "" ? "" : Number(e.target.value) } })}
                    className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded text-center text-slate-100"
                  />
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={submitCustom} className="border-t border-slate-800 pt-2 space-y-2">
            <label className="block text-amber-400 font-bold">➕ Create Custom Exercise</label>
            <input type="text" placeholder="Exercise Name" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded text-slate-100" required />
            <div className="grid grid-cols-3 gap-1">
              <select value={custom.target} onChange={(e) => setCustom({ ...custom, target: e.target.value })} className="bg-slate-950 border border-slate-700 p-1 rounded text-slate-200 text-[10px] capitalize">
                {CUSTOM_TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={custom.equipment} onChange={(e) => setCustom({ ...custom, equipment: e.target.value })} className="bg-slate-950 border border-slate-700 p-1 rounded text-slate-200 text-[10px] capitalize">
                {ALL_EQUIPMENT.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={custom.movement_pattern} onChange={(e) => setCustom({ ...custom, movement_pattern: e.target.value })} className="bg-slate-950 border border-slate-700 p-1 rounded text-slate-200 text-[10px] capitalize">
                {CUSTOM_PATTERNS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs py-1.5 rounded border border-slate-700">
              SAVE EXERCISE
            </button>
          </form>
        </div>

        <button onClick={onClose} className="w-full bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded">
          DONE
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-slate-400 mb-1 font-semibold">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-amber-400 w-4 h-4" />
      {label}
    </label>
  );
}
