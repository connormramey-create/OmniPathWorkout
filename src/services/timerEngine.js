/**
 * timerEngine.js — rest timer with a sound that works on phones.
 *
 * WHY THE OLD TIMER WAS SILENT ON PHONES
 *   1. It created a new AudioContext when the timer ended. Phones only allow sound from an
 *      AudioContext that was started during a tap, so that context stayed "suspended" (silent).
 *   2. Phones pause a background tab's JavaScript, so setInterval stopped counting.
 *
 * HOW THIS VERSION WORKS
 *   - Time is tracked with a timestamp (endAt), so the countdown is correct even after the
 *     phone throttles or pauses the page.
 *   - unlockAudio() runs during the tap that starts the timer, so the beep is allowed later.
 *   - Foreground mode (default): Web Audio beep when the timer ends. Mixes with music, but only
 *     rings while the tab is open, and on iPhone it follows the ring/silent switch.
 *   - Background mode (Settings → "Background timer alert"): when the timer starts we play an
 *     audio track that is N seconds of silence followed by the beep. Media playback keeps going
 *     when the tab is in the background or the screen is locked, so the beep plays on time.
 *     Trade-off: phones treat it like music, so it may pause Spotify etc. during the rest.
 *
 * Public API: unlockAudio, startRestTimer, adjustRestTimer, togglePauseRestTimer, stopRestTimer
 */

const TICK_MS = 250;
const MAX_BACKGROUND_SECONDS = 15 * 60; // longer rests fall back to foreground mode (keeps the file small)
const SAMPLE_RATE = 8000;

const state = {
  endAt: null,            // timestamp (ms) when the rest ends; null while paused/stopped
  pausedRemainingMs: null,
  intervalId: null,
  background: false,
  onTick: null,
  onFinish: null
};

let audioCtx = null;
let alertAudio = null;   // <audio> element used for background mode
let alertUrl = null;

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

/** Must be called from a tap/click handler. Makes later sounds allowed on iOS/Android. */
export function unlockAudio() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx && !audioCtx) audioCtx = new AudioCtx();
    if (audioCtx?.state === "suspended") audioCtx.resume();
    if (audioCtx) {
      // Playing a 1-sample silent buffer inside the tap fully unlocks iOS.
      const source = audioCtx.createBufferSource();
      source.buffer = audioCtx.createBuffer(1, 1, 22050);
      source.connect(audioCtx.destination);
      source.start(0);
    }
    if (!alertAudio && typeof Audio !== "undefined") {
      alertAudio = new Audio();
      alertAudio.preload = "auto";
      alertAudio.setAttribute("playsinline", "");
    }
  } catch (err) {
    console.warn("[timer] could not unlock audio:", err);
  }
}

function vibrate() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([200, 100, 200, 100, 400]); // Android only; iPhone ignores this
  }
}

/** Foreground beep using the unlocked AudioContext. */
export function playRestTimerFinishSound() {
  try {
    if (!audioCtx) unlockAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    [0, 0.4, 0.8].forEach((offset) => {
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc1.type = "sine";
      osc2.type = "triangle";
      osc1.frequency.value = 880;
      osc2.frequency.value = 1760;
      gain.gain.setValueAtTime(0.4, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);
      osc1.start(now + offset);
      osc2.start(now + offset);
      osc1.stop(now + offset + 0.3);
      osc2.stop(now + offset + 0.3);
    });
  } catch (err) {
    console.error("[timer] audio error:", err);
  }
}

/** Builds a WAV file: `silenceSeconds` of silence followed by three beeps. Returns a blob URL. */
export function buildAlertTrackUrl(silenceSeconds) {
  const beepPattern = [[0.25, true], [0.12, false], [0.25, true], [0.12, false], [0.4, true]];
  const beepSeconds = beepPattern.reduce((sum, [len]) => sum + len, 0);
  const silenceSamples = Math.max(0, Math.round(silenceSeconds * SAMPLE_RATE));
  const totalSamples = silenceSamples + Math.round(beepSeconds * SAMPLE_RATE);

  const buffer = new ArrayBuffer(44 + totalSamples);
  const view = new DataView(buffer);
  const writeText = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  // Standard 8-bit mono PCM WAV header
  writeText(0, "RIFF"); view.setUint32(4, 36 + totalSamples, true); writeText(8, "WAVE");
  writeText(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE, true); view.setUint16(32, 1, true);
  view.setUint16(34, 8, true); writeText(36, "data"); view.setUint32(40, totalSamples, true);

  const samples = new Uint8Array(buffer, 44);
  samples.fill(128); // 128 = silence for 8-bit audio
  let cursor = silenceSamples;
  beepPattern.forEach(([len, isTone]) => {
    const n = Math.round(len * SAMPLE_RATE);
    if (isTone) {
      for (let i = 0; i < n; i++) {
        const t = i / SAMPLE_RATE;
        const envelope = Math.min(1, i / 80) * Math.min(1, (n - i) / 400);
        const wave = 0.6 * Math.sin(2 * Math.PI * 880 * t) + 0.3 * Math.sin(2 * Math.PI * 1760 * t);
        samples[cursor + i] = Math.round(128 + 120 * envelope * wave);
      }
    }
    cursor += n;
  });
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function startBackgroundTrack(secondsUntilBeep) {
  if (!alertAudio) return false;
  stopBackgroundTrack();
  alertUrl = buildAlertTrackUrl(secondsUntilBeep);
  alertAudio.src = alertUrl;
  alertAudio.currentTime = 0;
  try {
    if ("mediaSession" in navigator && typeof window.MediaMetadata === "function") {
      navigator.mediaSession.metadata = new window.MediaMetadata({ title: "Rest timer", artist: "OmniPath Workout" });
    }
  } catch { /* lock-screen label is optional */ }
  const playing = alertAudio.play();
  if (playing?.catch) {
    playing.catch((err) => {
      console.warn("[timer] background alert blocked, falling back to foreground beep:", err);
      state.background = false;
    });
  }
  return true;
}

function stopBackgroundTrack() {
  if (alertAudio) alertAudio.pause();
  if (alertUrl) URL.revokeObjectURL(alertUrl);
  alertUrl = null;
}

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

function remainingMs() {
  if (state.pausedRemainingMs !== null) return state.pausedRemainingMs;
  if (state.endAt === null) return 0;
  return Math.max(0, state.endAt - Date.now());
}

function tick() {
  if (state.endAt === null) return; // paused or stopped
  const ms = remainingMs();
  state.onTick?.(Math.ceil(ms / 1000));
  if (ms <= 0) finish();
}

function finish() {
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.endAt = null;
  if (!state.background) playRestTimerFinishSound(); // background mode: the audio track beeps itself
  vibrate();
  const done = state.onFinish;
  state.onTick = null;
  state.onFinish = null;
  done?.();
}

// When the user comes back to the tab, update the display right away.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
  });
}

/**
 * Start (or restart) the rest timer. Call from a tap/click so audio is allowed.
 * @param {number} seconds
 * @param {{ onTick?: (secondsLeft:number)=>void, onFinish?: ()=>void, background?: boolean }} options
 */
export function startRestTimer(seconds, { onTick, onFinish, background = false } = {}) {
  unlockAudio();
  clearInterval(state.intervalId);
  stopBackgroundTrack();

  const secs = Math.max(1, Number(seconds) || 60);
  state.endAt = Date.now() + secs * 1000;
  state.pausedRemainingMs = null;
  state.onTick = onTick;
  state.onFinish = onFinish;
  state.background = background && secs <= MAX_BACKGROUND_SECONDS && startBackgroundTrack(secs);

  state.intervalId = setInterval(tick, TICK_MS);
  tick();
}

/** Add or remove time (e.g. +15 / -15). */
export function adjustRestTimer(secondsToAdd) {
  if (state.pausedRemainingMs !== null) {
    state.pausedRemainingMs = Math.max(0, state.pausedRemainingMs + secondsToAdd * 1000);
    state.onTick?.(Math.ceil(state.pausedRemainingMs / 1000));
    return;
  }
  if (state.endAt === null) return;
  state.endAt = Math.max(Date.now(), state.endAt + secondsToAdd * 1000);
  if (state.background) startBackgroundTrack(remainingMs() / 1000); // rebuild track with the new end time
  tick();
}

/** Pause/resume. Returns true if now paused. Call from a tap so resume can restart audio. */
export function togglePauseRestTimer() {
  if (state.pausedRemainingMs === null) {
    if (state.endAt === null) return false;
    state.pausedRemainingMs = remainingMs();
    state.endAt = null;
    if (state.background) alertAudio?.pause();
    return true;
  }
  state.endAt = Date.now() + state.pausedRemainingMs;
  state.pausedRemainingMs = null;
  if (state.background) startBackgroundTrack(remainingMs() / 1000);
  tick();
  return false;
}

export function stopRestTimer() {
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.endAt = null;
  state.pausedRemainingMs = null;
  state.onTick = null;
  state.onFinish = null;
  stopBackgroundTrack();
}
