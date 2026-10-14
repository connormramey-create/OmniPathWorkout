import { CooldownList, MissingGroupsNotice, WarmupList } from "./RoutineBlocks";
import { MUSCLE_GROUP_LABELS, getMuscleGroup } from "../services/workoutEngine";
import { PROGRESSION_SCHEMES, getMainLift } from "../services/progression";

export default function GeneratorTab({ settings, cycleWeek, session, onGenerate, onStart, onRestartCycle }) {
  const usesCycle = settings.profile !== "calisthenics" && settings.profile !== "program_builder"
    && settings.progressionScheme !== "linear";

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="font-bold text-slate-200">Session Routine Generator</h3>
          <p className="text-xs text-slate-400">
            Duration: {settings.duration}m | Split: {settings.split.replace("_", " ")} | Injury filter: {(settings.selectedInjury || "none").replace("_", " ")}
          </p>
          {usesCycle && (
            <p className="text-xs text-slate-400 mt-1">
              {PROGRESSION_SCHEMES[settings.progressionScheme]} · <b className="text-amber-300">Cycle week {cycleWeek}</b>{" "}
              <button onClick={onRestartCycle} className="underline text-slate-500 hover:text-slate-300">restart cycle</button>
            </p>
          )}
        </div>
        <button onClick={onGenerate} className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs px-4 py-2 rounded">
          GENERATE NOW
        </button>
      </div>

      {session && (
        <div className="bg-slate-900 p-5 rounded-lg border border-amber-400/30 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3 gap-3">
            <div>
              <h2 className="text-xl font-bold text-amber-400">{session.title}</h2>
              {settings.progressionScheme === "conjugate" && settings.profile !== "calisthenics" && (
                <p className="text-xs text-slate-400">{session.effortType === "dynamic" ? "Dynamic Effort (speed) day" : "Max Effort day"}</p>
              )}
            </div>
            <button onClick={() => onStart(session)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-4 py-2 rounded">
              START WORKOUT
            </button>
          </div>

          <MissingGroupsNotice groups={session.missingGroups} />
          <WarmupList items={session.warmups} />

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400">💪 TARGETED EXERCISES</h4>
            {session.exercises.map((ex) => (
              <div key={ex.id || ex.name} className="bg-slate-950 p-3 rounded border border-slate-800 flex justify-between items-center gap-2">
                <div>
                  <div className="font-bold text-sm text-slate-200">{ex.name}</div>
                  <div className="text-xs text-slate-500">
                    {MUSCLE_GROUP_LABELS[getMuscleGroup(ex)] || ex.target} · {ex.target} · {ex.equipment}
                  </div>
                </div>
                <div className="flex gap-1">
                  {getMainLift(ex) && settings.profile !== "calisthenics" && <Badge color="amber">MAIN LIFT</Badge>}
                  {ex.treeStep?.isNextSkill && <Badge color="purple">NEXT SKILL</Badge>}
                  {ex.treeStep?.isMastered && <Badge color="slate">SKILL LVL {ex.treeStep.level}</Badge>}
                </div>
              </div>
            ))}
          </div>

          <CooldownList items={session.cooldowns} />
        </div>
      )}
    </div>
  );
}

const BADGE_COLORS = {
  amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  purple: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  slate: "bg-slate-700/40 text-slate-300 border-slate-600"
};

function Badge({ color, children }) {
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold whitespace-nowrap ${BADGE_COLORS[color]}`}>{children}</span>;
}
