import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import bundledVideos from "virtual:exercise-videos";
import { REMOTE_SITE_URL } from "../config/videos";

const isNative = Capacitor.isNativePlatform();
const BASE_URL = isNative ? REMOTE_SITE_URL : "./";

// The phone apps check the website once per launch for clips added since the app was built.
let remoteVideosPromise = null;
function loadRemoteVideos() {
  if (!remoteVideosPromise) {
    remoteVideosPromise = fetch(`${REMOTE_SITE_URL}videos/index.json`, { cache: "no-cache" })
      .then((res) => (res.ok ? res.json() : bundledVideos))
      .catch(() => bundledVideos);
  }
  return remoteVideosPromise;
}

function useVideoFile(exerciseId) {
  const [videos, setVideos] = useState(bundledVideos);
  useEffect(() => {
    if (!isNative) return;
    let active = true;
    loadRemoteVideos().then((list) => active && setVideos(list));
    return () => { active = false; };
  }, []);
  return exerciseId ? videos[exerciseId] : undefined;
}

/**
 * "▶ Demo" button that expands a looping, silent clip of the exercise.
 * Renders nothing when there's no clip for this exercise yet, so you can add videos gradually.
 */
export default function ExerciseVideo({ exerciseId }) {
  const file = useVideoFile(exerciseId);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!file) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded"
      >
        {open ? "■ HIDE DEMO" : "▶ DEMO"}
      </button>
      {open && (
        failed ? (
          <p className="text-[10px] text-slate-500 mt-1">Couldn't load the demo video. Check your connection.</p>
        ) : (
          <video
            src={`${BASE_URL}videos/${file}`}
            autoPlay muted loop playsInline
            preload="metadata"
            onError={() => setFailed(true)}
            className="mt-2 w-full max-w-xs rounded border border-slate-800 bg-black"
          />
        )
      )}
    </div>
  );
}
