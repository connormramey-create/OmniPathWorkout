import { useState } from "react";
import CommunityPrograms from "./CommunityPrograms";

const selectClass = "w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-100";

/** Program Planner tab: Standard plan generator, or Program Builder for that profile. */
export default function PlanTab(props) {
  return props.settings.profile === "program_builder"
    ? <ProgramBuilderPanel {...props} />
    : <StandardPlanPanel {...props} />;
}

// ---------------------------------------------------------------------------
// Standard plan
// ---------------------------------------------------------------------------

function StandardPlanPanel({ plan, onBuildStandard, onStartDay }) {
  const [months, setMonths] = useState(1);
  const hasPlan = plan?.type === "standard_plan";

  return (
    <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 space-y-4">
      <h3 className="font-bold text-amber-400 text-lg">Standard Program Generator</h3>
      <p className="text-xs text-slate-400">Generate a multi-week plan based on your Workout Style, Split and Progression Scheme.</p>
      <div>
        <label className="block text-slate-400 mb-1 text-xs">Plan Duration</label>
        <select value={months} onChange={(e) => setMonths(parseInt(e.target.value, 10))} className={`${selectClass} text-xs`}>
          <option value={1}>1 Month (4 Weeks)</option>
          <option value={2}>2 Months (8 Weeks)</option>
          <option value={3}>3 Months (12 Weeks)</option>
          <option value={4}>4 Months (16 Weeks)</option>
        </select>
      </div>
      <button
        onClick={() => (!hasPlan || confirm("Replace your current plan? Progress on it will be lost.")) && onBuildStandard(months)}
        className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs py-2 rounded"
      >
        GENERATE PLAN
      </button>

      {hasPlan && (
        <div className="space-y-4 mt-6 border-t border-slate-800 pt-4">
          {plan.weeks.map((w) => (
            <div key={w.weekNum} className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-amber-400">WEEK {w.weekNum}</div>
              <div className="grid grid-cols-1 gap-2">
                {w.days.map((d) => (
                  <div key={d.id} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800 text-xs">
                    <span className={d.completed ? "text-slate-500 line-through" : "text-slate-200"}>Day {d.dayNum}: {d.title}</span>
                    {d.type !== "rest" && !d.completed && (
                      <button onClick={() => onStartDay(d, w.weekNum)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-2 py-1 rounded font-bold">START</button>
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
  );
}

// ---------------------------------------------------------------------------
// Program Builder
// ---------------------------------------------------------------------------

function ProgramBuilderPanel({
  plan, currentUser, customExercises, onBuildProgram, onPickSlot, onStartDay, onCopyFirstWeek,
  onSetPublic, onCopyCommunityProgram, shareStatus
}) {
  const [config, setConfig] = useState({
    title: "My Custom Program", weeks: 4, progressionRate: 2.5, exercisesPerSession: 5,
    workoutsPerWeek: 4, restTime: 90, makePublic: false
  });
  const [authorName, setAuthorName] = useState(currentUser?.displayName || "");
  const hasPlan = plan?.type === "program_builder";
  const update = (patch) => setConfig({ ...config, ...patch });
  const num = (v, fallback) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback);

  const build = () => {
    if (hasPlan && !confirm("Replace your current custom program? Assigned exercises will be lost.")) return;
    onBuildProgram(config, authorName);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-6 rounded-lg border border-cyan-500/30 space-y-4">
        <h3 className="font-bold text-cyan-400 text-lg">Program Builder Wizard</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="col-span-2">
            <label className="block text-slate-400 mb-1">Program Name</label>
            <input type="text" maxLength={80} value={config.title} onChange={(e) => update({ title: e.target.value })} className={selectClass} />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Duration (Weeks)</label>
            <select value={config.weeks} onChange={(e) => update({ weeks: parseInt(e.target.value, 10) })} className={selectClass}>
              {[4, 8, 12, 16].map((w) => <option key={w} value={w}>{w} Weeks ({w / 4} Month{w > 4 ? "s" : ""})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Weekly Progression (%)</label>
            <input type="number" step="0.5" value={config.progressionRate} onChange={(e) => update({ progressionRate: num(e.target.value, 0) })} className={selectClass} />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Exercises per Session</label>
            <input type="number" min="1" max="15" value={config.exercisesPerSession} onChange={(e) => update({ exercisesPerSession: num(e.target.value, 5) })} className={selectClass} />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Workouts per Week</label>
            <input type="number" min="1" max="7" value={config.workoutsPerWeek} onChange={(e) => update({ workoutsPerWeek: num(e.target.value, 4) })} className={selectClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-slate-400 mb-1">Rest Between Sets (seconds)</label>
            <input type="number" min="5" value={config.restTime} onChange={(e) => update({ restTime: num(e.target.value, 90) })} className={selectClass} />
          </div>
        </div>
        <p className="text-[10px] text-slate-500">
          Weekly progression adds that % to barbell main lifts each week (starting at 70% of your 1RM).
          Other exercises progress by reps, then +5 lbs.
        </p>

        <ShareControls
          currentUser={currentUser}
          isPublic={config.makePublic}
          onToggle={(v) => update({ makePublic: v })}
          authorName={authorName}
          setAuthorName={setAuthorName}
          hint="Your program is published when you build it, and the public copy updates as you fill in exercises."
        />

        <button onClick={build} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs py-2 rounded">
          BUILD CUSTOM SKELETON
        </button>
      </div>

      {hasPlan && (
        <div className="bg-slate-900 p-6 rounded-lg border border-cyan-500/30 space-y-4">
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <div>
              <h4 className="font-bold text-slate-200 text-sm">{plan.title || "Interactive Program Cycle"}</h4>
              {plan.copiedFrom && <p className="text-[10px] text-slate-500">Copied from {plan.copiedFrom.authorName}</p>}
            </div>
            <button onClick={onCopyFirstWeek} className="text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300 px-2 py-1 rounded border border-slate-700">
              COPY WEEK 1 → ALL WEEKS
            </button>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <ShareControls
              currentUser={currentUser}
              isPublic={!!plan.isPublic}
              onToggle={(v) => onSetPublic(v, authorName)}
              authorName={authorName}
              setAuthorName={setAuthorName}
              hint={plan.isPublic ? "Public: logged-in users can view and copy this program. Changes sync automatically." : "Private: only you can see this program."}
            />
            {shareStatus && <p className="text-[10px] mt-2 text-cyan-300">{shareStatus}</p>}
          </div>

          {plan.weeks.map((w) => (
            <div key={w.weekNum} className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-cyan-400">WEEK {w.weekNum}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {w.days.map((d) => {
                  const filled = d.exercises.filter(Boolean).length;
                  return (
                    <div key={d.id} className="bg-slate-900 p-2 rounded border border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className={`font-bold ${d.completed ? "text-slate-500 line-through" : "text-slate-300"}`}>{d.title}</span>
                        {d.completed ? (
                          <span className="text-emerald-500 font-bold text-[10px]">DONE</span>
                        ) : (
                          <button disabled={filled === 0} onClick={() => onStartDay(d, w.weekNum)} className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-slate-950 px-2 py-0.5 rounded font-bold text-[10px]">
                            START
                          </button>
                        )}
                      </div>
                      {d.exercises.map((slot, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => onPickSlot({ weekNum: w.weekNum, dayNum: d.dayNum, slotIdx: sIdx })}
                          className={`w-full text-left p-1.5 rounded text-[10px] font-semibold border ${slot ? "bg-slate-950 border-cyan-400/40 text-cyan-300" : "bg-slate-800/40 border-dashed border-slate-700 text-slate-500"}`}
                        >
                          {slot ? slot.name : `+ Slot ${sIdx + 1}`}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <CommunityPrograms currentUser={currentUser} customExercises={customExercises} hasPlan={hasPlan} onCopy={onCopyCommunityProgram} />
    </div>
  );
}

function ShareControls({ currentUser, isPublic, onToggle, authorName, setAuthorName, hint }) {
  if (!currentUser) {
    return <p className="text-[11px] text-slate-500">🔒 Log in to make a program public for other users.</p>;
  }
  return (
    <div className="space-y-2 text-xs">
      <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
        <input type="checkbox" checked={isPublic} onChange={(e) => onToggle(e.target.checked)} className="accent-cyan-400 w-4 h-4" />
        Make this program public
      </label>
      {isPublic && (
        <div>
          <label className="block text-slate-400 mb-1 text-[10px]">Public display name (your email is never shown)</label>
          <input type="text" maxLength={40} placeholder="e.g. Connor R." value={authorName} onChange={(e) => setAuthorName(e.target.value)} className={selectClass} />
        </div>
      )}
      <p className="text-[10px] text-slate-500">{hint}</p>
    </div>
  );
}
