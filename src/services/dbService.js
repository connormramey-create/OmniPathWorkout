import { db } from '../config/firebase';

export function getPlanStorageKey(workoutStyle = "standard") {
  return `gymbro_active_plan_${workoutStyle}`;
}

export function exportHistoryToCSV(workoutHistory = []) {
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
  anchor.download = `iron_bro_progress_log_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function syncUserDataFromCloud(uid, callbacks = {}) {
  if (!uid || !db) return;
  const userRef = db.ref(`users/${uid}`);
  userRef.on("value", (snapshot) => {
    const data = snapshot.val();
    if (data && callbacks.onDataLoaded) {
      callbacks.onDataLoaded(data);
    }
  });
}

export function saveUserDataToCloud(uid, data) {
  if (!uid || !db) return;
  db.ref(`users/${uid}`).update(data);
}
