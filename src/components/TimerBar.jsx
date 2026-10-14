import { formatClock } from "../hooks/useRestTimer";

export default function TimerBar({ timer }) {
  if (!timer.visible) return null;
  const btn = "text-xs font-bold bg-slate-800 px-2 py-1 rounded text-slate-300";
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-slate-100 border border-amber-400/40 rounded-full px-4 sm:px-6 py-3 shadow-2xl flex items-center gap-2 sm:gap-4 z-[60] max-w-[calc(100vw-2rem)]">
      <div className="text-xs font-bold text-amber-400 hidden sm:block">REST</div>
      <div className="text-lg font-black tracking-widest text-slate-100">{formatClock(timer.remaining)}</div>
      <button onClick={() => timer.adjust(-15)} className={btn}>-15s</button>
      <button onClick={() => timer.adjust(15)} className={btn}>+15s</button>
      <button onClick={timer.togglePause} className={btn}>{timer.paused ? "RESUME" : "PAUSE"}</button>
      <button onClick={timer.stop} className="text-xs text-slate-400">SKIP</button>
    </div>
  );
}
