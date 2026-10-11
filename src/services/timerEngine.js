let activeTimerInterval = null;

export function playRestTimerFinishSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(1760, ctx.currentTime);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 1.2);
    osc2.stop(ctx.currentTime + 1.2);
  } catch (err) {
    console.error("Audio playback error:", err);
  }

  if ("vibrate" in navigator) {
    navigator.vibrate([200, 100, 200, 100, 400]);
  }
}

export function stopRestTimer() {
  if (activeTimerInterval) {
    clearInterval(activeTimerInterval);
    activeTimerInterval = null;
  }
}

export function startRestTimer(seconds, onTick, onFinish) {
  stopRestTimer();
  let remaining = seconds;
  if (onTick) onTick(remaining);

  activeTimerInterval = setInterval(() => {
    remaining -= 1;
    if (onTick) onTick(remaining);

    if (remaining <= 0) {
      stopRestTimer();
      playRestTimerFinishSound();
      if (onFinish) onFinish();
    }
  }, 1000);

  return activeTimerInterval;
}

export function togglePauseRestTimer(isCurrentlyPaused, remainingSeconds, onTick, onFinish) {
  if (!isCurrentlyPaused) {
    stopRestTimer();
    return true; // Returns new paused state (true)
  } else {
    startRestTimer(remainingSeconds, onTick, onFinish);
    return false; // Returns new paused state (false)
  }
}

export function adjustRestTimer(currentSeconds, deltaSeconds) {
  return Math.max(0, currentSeconds + deltaSeconds);
}
