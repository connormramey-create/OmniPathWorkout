import { CALISTHENICS_TREES, getCalisthenicsAccess } from "../services/workoutEngine";

/** Calisthenics skill trees. Checked = mastered. Generator uses mastered + the next step. */
export default function PathwaysTab({ mastered, onToggle }) {
  const { stepByName } = getCalisthenicsAccess(mastered);

  return (
    <div className="space-y-4 bg-slate-900 p-5 rounded-lg border border-purple-500/30">
      <h3 className="font-bold text-purple-400 text-lg">Calisthenics Skill Progression Pathways</h3>
      <p className="text-xs text-slate-400">
        Check the skills you have mastered. Workouts only include your mastered skills plus the next level
        (marked <b className="text-purple-300">NEXT</b>). Locked skills never appear. Other bodyweight exercises are
        limited to the difficulty of the hardest skill you've unlocked in the related pathway.
      </p>
      {Object.entries(CALISTHENICS_TREES).map(([treeKey, tree]) => (
        <div key={treeKey} className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2">
          <h4 className="text-xs font-bold uppercase text-purple-300">{tree.label} Pathway</h4>
          <div className="space-y-1">
            {tree.steps.map((s) => {
              const info = stepByName.get(s.exercise);
              const status = info.isMastered ? "MASTERED" : info.isNextSkill ? "NEXT" : "LOCKED";
              return (
                <label key={s.level} className={`flex items-center gap-3 text-xs p-2 rounded border cursor-pointer transition-colors ${info.isMastered ? "bg-purple-900/30 border-purple-500/50" : "bg-slate-900 border-slate-800/60"}`}>
                  <input type="checkbox" checked={info.isMastered} onChange={() => onToggle(s.exercise)} className="accent-purple-500 w-4 h-4" />
                  <div className="flex-1 flex justify-between items-center gap-2">
                    <span className={info.isMastered ? "text-purple-300 font-bold" : info.unlocked ? "text-slate-200" : "text-slate-500"}>
                      Lvl {s.level}: {s.exercise}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-slate-500 text-[10px]">{s.reps}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${status === "NEXT" ? "bg-purple-500/20 text-purple-300" : status === "LOCKED" ? "text-slate-600" : "text-purple-400"}`}>{status}</span>
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
