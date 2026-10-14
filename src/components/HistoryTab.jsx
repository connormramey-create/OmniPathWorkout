import { useState } from "react";
import { exportHistoryToCSV } from "../services/dbService";

export default function HistoryTab({ history }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-200">Completed Sessions</h3>
        <button onClick={() => exportHistoryToCSV(history)} className="bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold px-3 py-1.5 rounded border border-slate-700">
          EXPORT LOG TO CSV
        </button>
      </div>
      {history.length === 0 && <p className="text-xs text-slate-500">No workouts logged yet.</p>}
      {history.map((item) => (
        <div key={item.id} className="bg-slate-900 p-4 rounded-lg border border-slate-800">
          <div className="flex justify-between items-center cursor-pointer gap-3" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
            <div>
              <div className="font-bold text-sm text-slate-200">{item.title}</div>
              <div className="text-xs text-slate-500">{item.date} • {item.exerciseCount} Exercises • {item.totalCompletedSets} Sets</div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="text-amber-400 font-bold text-sm bg-amber-400/10 px-3 py-1 rounded border border-amber-400/20 whitespace-nowrap">
                {item.totalVolume > 0 ? `${item.totalVolume.toLocaleString()} lbs` : `${item.totalReps || 0} reps`}
              </div>
              <div className="text-slate-400 text-xs">{expandedId === item.id ? "▲" : "▼"}</div>
            </div>
          </div>
          {expandedId === item.id && item.logs && (
            <div className="mt-4 border-t border-slate-800 pt-4 space-y-3">
              {item.logs.map((log, lIdx) => (
                <div key={lIdx} className="text-xs text-slate-300">
                  <div className="font-bold text-amber-400 mb-1">{log.name}</div>
                  {(log.sets || []).map((set, sIdx) => set.completed && (
                    <div key={sIdx} className="ml-4 flex gap-4 text-slate-400 border-l border-slate-800 pl-2 mb-1">
                      <span>Set {sIdx + 1}:</span>
                      <span className="text-slate-200">{set.weight || 0} lbs × {set.reps || 0} reps</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
