import { useCallback, useState } from "react";
import {
  adjustRestTimer,
  startRestTimer,
  stopRestTimer,
  togglePauseRestTimer
} from "../services/timerEngine";

/** React wrapper around timerEngine. All handlers must be called from a tap/click. */
export default function useRestTimer({ background }) {
  const [remaining, setRemaining] = useState(0);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);

  const start = useCallback((seconds) => {
    setVisible(true);
    setPaused(false);
    startRestTimer(seconds, {
      background,
      onTick: setRemaining,
      onFinish: () => setVisible(false)
    });
  }, [background]);

  const adjust = useCallback((delta) => adjustRestTimer(delta), []);
  const togglePause = useCallback(() => setPaused(togglePauseRestTimer()), []);
  const stop = useCallback(() => { stopRestTimer(); setVisible(false); }, []);

  return { remaining, visible, paused, start, adjust, togglePause, stop };
}

export function formatClock(totalSeconds) {
  const secs = Math.max(0, totalSeconds || 0);
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}
