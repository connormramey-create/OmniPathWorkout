let timerInterval = null;
let timerRemainingSeconds = 0;
let isTimerPaused = false;

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
    console.error("Audio error:", err);
  }

  if ("vibrate" in navigator) {
    navigator.vibrate([200, 100, 200, 100, 400]);
  }
}

export function startRestTimer(seconds, onTick, onFinish) {
  clearInterval(timerInterval);
  timerRemainingSeconds = seconds || 60;
  isTimerPaused = false;

  const tick = () => {
    if (isTimerPaused) return;

    if (onTick) onTick(timerRemainingSeconds);

    if (timerRemainingSeconds <= 0) {
      clearInterval(timerInterval);
      playRestTimerFinishSound();
      if (onFinish) onFinish();
      return;
    }
    timerRemainingSeconds--;
  };

  tick();
  timerInterval = setInterval(tick, 1000);
}

export function adjustRestTimer(secondsToAdd, onTick) {
  timerRemainingSeconds = Math.max(0, timerRemainingSeconds + secondsToAdd);
  if (onTick) onTick(timerRemainingSeconds);
}

export function togglePauseRestTimer() {
  isTimerPaused = !isTimerPaused;
  return isTimerPaused;
}

export function stopRestTimer() {
  clearInterval(timerInterval);
  timerRemainingSeconds = 0;
}
