/** Warm-up and cool-down lists shared by the generator preview and the active workout. */

export function WarmupList({ items }) {
  if (!items?.length) return null;
  return (
    <div className="bg-slate-950 p-4 rounded border border-amber-500/20">
      <h4 className="text-xs font-bold text-amber-400 mb-2">🔥 DYNAMIC WARM-UP & PREHAB</h4>
      <div className="space-y-2">
        {items.map((w) => (
          <div key={w.name} className="flex justify-between gap-3 text-xs border-b border-slate-800/50 pb-1">
            <span className="font-semibold text-slate-300" title={w.desc}>
              {w.name}{" "}
              {w.isPrehab && (
                <span className="text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/30 font-bold">PREHAB</span>
              )}
            </span>
            <span className="text-amber-300 whitespace-nowrap">{w.duration}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CooldownList({ items }) {
  if (!items?.length) return null;
  return (
    <div className="bg-slate-950 p-4 rounded border border-slate-700/30">
      <h4 className="text-xs font-bold text-slate-400 mb-2">🧘 COOL-DOWN STRETCHES</h4>
      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.name} className="flex justify-between gap-3 text-xs border-b border-slate-800/50 pb-1">
            <span className="font-semibold text-slate-300" title={c.desc}>{c.name}</span>
            <span className="text-slate-400 whitespace-nowrap">{c.duration}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MissingGroupsNotice({ groups }) {
  if (!groups?.length) return null;
  return (
    <div className="text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded p-3">
      No exercise available for: <b>{groups.join(", ")}</b>. Check your equipment, injury filter or
      (for calisthenics) unlock the next skill in Progression Pathways.
    </div>
  );
}
