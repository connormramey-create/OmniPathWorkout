import { useMemo, useState } from "react";
import { ALL_EXERCISES, MUSCLE_GROUP_LABELS, getMuscleGroup } from "../services/workoutEngine";

const MAX_RESULTS = 100;

/** Search the exercise library (+ custom exercises) and pick one for a Program Builder slot. */
export default function ExercisePickerModal({ customExercises, onPick, onClear, onClose }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return [...ALL_EXERCISES, ...customExercises]
      .filter((ex) => !q || `${ex.name} ${ex.target} ${ex.equipment}`.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [query, customExercises]);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-bold text-cyan-400">Select Exercise for Slot</h3>
        <input
          autoFocus type="text" placeholder="Search by name, muscle or equipment…" value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-xs text-slate-100"
        />
        <div className="max-h-72 overflow-y-auto space-y-1">
          {results.map((ex) => (
            <button key={ex.id || ex.name} onClick={() => onPick(ex)} className="w-full text-left p-2 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-xs text-slate-200 flex justify-between gap-2">
              <span>{ex.name}</span>
              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                {MUSCLE_GROUP_LABELS[getMuscleGroup(ex)] || ex.target} · {ex.equipment}
              </span>
            </button>
          ))}
          {results.length === 0 && <p className="text-xs text-slate-500">No matches.</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={onClear} className="flex-1 bg-slate-800 text-rose-300 text-xs py-1.5 rounded">CLEAR SLOT</button>
          <button onClick={onClose} className="flex-1 bg-slate-800 text-slate-400 text-xs py-1.5 rounded">CANCEL</button>
        </div>
      </div>
    </div>
  );
}
