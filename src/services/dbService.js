import { db } from "../config/firebase";

export function getPlanStorageKey(style = "standard") {
  return `gymbro_active_plan_${style}`;
}

export function syncUserDataFromCloud(uid, onDataSync) {
  const userRef = db.ref(`users/${uid}`);
  userRef.on("value", (snapshot) => {
    const data = snapshot.val();
    if (data && onDataSync) {
      onDataSync(data);
    }
  });
}

export function saveUserDataToCloud(uid, payload, style = "standard", activePlan = null) {
  if (!uid) return;
  
  db.ref(`users/${uid}`).update({
    settings: payload.settings,
    history: payload.history,
    exercise_history: payload.exerciseHistory,
    custom_exercises: payload.customExercises,
    calisthenics_skills: payload.calisthenicsSkills
  });

  if (activePlan) {
    db.ref(`users/${uid}/plans/${style}`).set(activePlan);
  }
}

export function exportHistoryToCSV(workoutHistory) {
  if (!workoutHistory || workoutHistory.length === 0) {
    alert("No logged workout history available to export.");
    return;
  }
  let csvContent = "Date,Workout Title,Exercises Completed,Total Volume (lbs)\n";
  workoutHistory.forEach(row => {
    csvContent += `"${row.date || ''}","${(row.title || '').replace(/"/g, '""')}",${row.exerciseCount || 0},${row.totalVolume || 0}\n`;
  });
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `omnipath_progress_log_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
