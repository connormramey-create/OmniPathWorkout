import { db } from "../config/firebase";

export function getPlanStorageKey(style = "standard") {
  return `gymbro_active_plan_${style}`;
}

export function syncUserDataFromCloud(uid, onDataSync) {
  if (!db || !uid) return;
  const userRef = db.ref(`users/${uid}`);
  userRef.on("value", (snapshot) => {
    const data = snapshot.val();
    if (data && onDataSync) {
      onDataSync(data);
    }
  });
}

export function saveUserDataToCloud(uid, payload, style = "standard", activePlan = null) {
  if (!db || !uid) return;

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

export function exportHistoryToCSV(workoutHistory = []) {
  if (!workoutHistory || workoutHistory.length === 0) {
    alert("No logged workout history available to export.");
    return;
  }
  
  // Create deeper structural headers for expansion
  let csvContent = "Date,Workout Title,Exercise Name,Set Number,Weight (lbs),Reps Completed\n";
  
  workoutHistory.forEach(row => {
    const date = row.date || '';
    const title = (row.title || '').replace(/"/g, '""');

    if (row.logs && row.logs.length > 0) {
      row.logs.forEach(log => {
        const exName = (log.name || '').replace(/"/g, '""');
        let hasCompletedSet = false;

        if (log.sets) {
          log.sets.forEach((set, idx) => {
            if (set.completed) {
              hasCompletedSet = true;
              csvContent += `"${date}","${title}","${exName}",${idx + 1},${set.weight || 0},${set.reps || 0}\n`;
            }
          });
        }

        // Output safety log row if an exercise was technically loaded but uncompleted
        if (!hasCompletedSet) {
           csvContent += `"${date}","${title}","${exName} (No Sets Logged)",-,-,-\n`;
        }
      });
    } else {
      // Graceful fallback for history logs saved before the expandable detail tracking upgrade
      csvContent += `"${date}","${title}","Summary Only",-,${row.totalVolume || 0},0\n`;
    }
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `omnipath_progress_log_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
