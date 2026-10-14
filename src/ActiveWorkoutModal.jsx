import { CooldownList, WarmupList } from "./RoutineBlocks";
import { formatClock } from "../hooks/useRestTimer";

export default function ActiveWorkoutModal({ workout, timer, onToggleSet, onUpdateSet, onMinimize, onFinish, onDiscard }) {
  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 max-w-2xl w-full rounded-lg p-4 sm:p-6 space-y-6 my-auto">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3 gap-3">
          <div>
            <h2 className="text-xl font-bold text-amber-400">{workout.title}</h2>
            {timer.visible && (
              <div className="text-xs text-amber-300 font-mono mt-1 font-bold">⏱️ Rest: {formatClock(timer.remaining)}</div>
            )}
          </div>
          <button onClick={onMinimize} className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">MINIMIZE</button>
        </div>

        <WarmupList items={workout.warmups} />

        <div className="space-y-4">
          {workout.logs.map((ex, exIdx) => (
            <div key={ex.id || exIdx} className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-bold text-sm text-slate-200">{ex.name}</div>
                  <div className="text-[10px] text-slate-500">{ex.group}</div>
                </div>
                {ex.isMainLift && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">MAIN LIFT</span>}
              </div>
              {ex.note && <div className="text-[11px] text-emerald-300">{ex.note}</div>}
              {ex.lastRecord && <div className="text-[10px] text-amber-400">Last time: {ex.lastRecord}</div>}

              <div className="space-y-1">
                {ex.sets.map((set, setIdx) => (
                  <div key={setIdx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/40 gap-2">
                    <span className="text-slate-400 w-14 shrink-0">
                      Set {setIdx + 1}{set.isAmrap && <b className="text-amber-300"> +</b>}
                    </span>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <input type="number" inputMode="decimal" placeholder="—" value={set.weight} onChange={(e) => onUpdateSet(exIdx, setIdx, "weight", e.target.value)} className="w-16 bg-slate-900 border border-slate-700 text-center rounded px-1 text-slate-100" />
                      <span className="text-slate-500">lbs</span>
                      <input type="number" inputMode="numeric" value={set.reps} onChange={(e) => onUpdateSet(exIdx, setIdx, "reps", e.target.value)} className="w-12 bg-slate-900 border border-slate-700 text-center rounded px-1 text-slate-100" />
                      <span className="text-slate-500">{set.isAmrap ? "reps+" : "reps"}</span>
                    </div>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={set.completed} onChange={() => onToggleSet(exIdx, setIdx)} className="accent-amber-400 w-4 h-4" />
                      <span className={set.completed ? "text-emerald-400 font-bold" : "text-slate-500"}>DONE</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <CooldownList items={workout.cooldowns} />

        <button onClick={onFinish} className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm py-3 rounded">
          FINISH & LOG WORKOUT
        </button>
        <button onClick={onDiscard} className="w-full text-xs text-slate-500 hover:text-rose-400">Discard this workout</button>
      </div>
    </div>
  );
}
