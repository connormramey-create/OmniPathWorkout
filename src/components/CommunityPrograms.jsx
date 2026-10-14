import { useState } from "react";
import { fetchPublicPrograms } from "../services/dbService";

/** Browse programs other users made public, and copy one into your Program Builder. */
export default function CommunityPrograms({ currentUser, hasPlan, onCopy }) {
  const [programs, setPrograms] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  if (!currentUser) {
    return (
      <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 text-xs text-slate-500">
        🌐 Log in to browse programs shared by other users.
      </div>
    );
  }

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setPrograms(await fetchPublicPrograms());
    } catch (err) {
      console.error("[community] load failed:", err);
      setError("Couldn't load community programs. If this keeps happening, check the database rules are published (see README).");
    } finally {
      setLoading(false);
    }
  };

  const copy = (program) => {
    if (hasPlan && !confirm(`Replace your current custom program with "${program.title}"?`)) return;
    onCopy(program);
  };

  return (
    <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 space-y-3">
      <div className="flex justify-between items-center gap-3">
        <h3 className="font-bold text-cyan-400">🌐 Community Programs</h3>
        <button onClick={load} disabled={loading} className="text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3 py-1.5 rounded border border-slate-700">
          {loading ? "LOADING…" : programs ? "REFRESH" : "BROWSE"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {programs && programs.length === 0 && <p className="text-xs text-slate-500">No public programs yet. Be the first!</p>}
      {programs?.map((p) => {
        const isMine = p.authorUid === currentUser.uid;
        const filled = p.weeks.reduce((n, w) => n + w.days.reduce((m, d) => m + d.exercises.filter(Boolean).length, 0), 0);
        return (
          <div key={p.id} className="bg-slate-950 p-3 rounded border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between items-start gap-2">
              <div className="cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                <div className="font-bold text-slate-200">{p.title} {isMine && <span className="text-[10px] text-cyan-400">(yours)</span>}</div>
                <div className="text-slate-500">
                  by {p.authorName} · {p.durationWeeks} weeks · {p.workoutsPerWeek} days/week · {filled} exercises assigned
                </div>
              </div>
              <button onClick={() => copy(p)} className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold px-2 py-1 rounded text-[10px] whitespace-nowrap">COPY TO MY PROGRAM</button>
            </div>
            {expandedId === p.id && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {p.weeks[0]?.days.map((d) => (
                  <div key={d.id || d.dayNum} className="bg-slate-900 p-2 rounded border border-slate-800">
                    <div className="font-bold text-slate-300 mb-1">Week 1 · {d.title}</div>
                    {d.exercises.filter(Boolean).map((ex, i) => <div key={i} className="text-slate-400">• {ex.name}</div>)}
                    {d.exercises.filter(Boolean).length === 0 && <div className="text-slate-600">No exercises yet</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
