import exercisesData from '../data/exercises.json';

export const CALISTHENICS_SKILL_TREES = {
  push: [
    { level: 1, name: "Push-Up", reps: "8-12 reps" },
    { level: 2, name: "Diamond Push-Up", reps: "8-12 reps" },
    { level: 3, name: "Pike Push-Up", reps: "6-10 reps" },
    { level: 4, name: "Elevated Pike Push-Up", reps: "5-8 reps" },
    { level: 5, name: "Handstand Push-Up (Wall Supported)", reps: "3-5 reps" }
  ],
  pull: [
    { level: 1, name: "Australian Inverted Row", reps: "8-12 reps" },
    { level: 2, name: "Chin-Up", reps: "6-10 reps" },
    { level: 3, name: "Pull-Up", reps: "5-8 reps" },
    { level: 4, name: "Archer Pull-Up", reps: "4-6 reps" },
    { level: 5, name: "Muscle-Up", reps: "2-4 reps" }
  ],
  legs: [
    { level: 1, name: "Air Squat", reps: "15-20 reps" },
    { level: 2, name: "Bulgarian Split Squat", reps: "8-12 reps" },
    { level: 3, name: "Shrimp Squat", reps: "5-8 reps" },
    { level: 4, name: "Pistol Squat", reps: "3-6 reps" }
  ]
};

export function generateWorkoutSession(split = "upper_lower", duration = 45, equipment = ["barbell", "dumbbell", "cable", "body weight"]) {
  const exerciseCount = Math.max(3, Math.floor(duration / 7.5));
  
  const activeEquipment = equipment.map(e => e.toLowerCase().trim());
  const availableExercises = exercisesData.filter(ex => 
    activeEquipment.includes((ex.equipment || '').toLowerCase().trim())
  );

  const pool = availableExercises.length > 0 ? availableExercises : exercisesData;
  const poolCopy = [...pool];
  const selected = [];

  while (selected.length < exerciseCount && poolCopy.length > 0) {
    const idx = Math.floor(Math.random() * poolCopy.length);
    selected.push(poolCopy.splice(idx, 1)[0]);
  }

  return {
    title: `${split.toUpperCase().replace('_', ' ')} SESSION`,
    exercises: selected,
    warmups: ["Arm Circles - 60s", "Bodyweight Squats - 60s"],
    cooldowns: ["Doorway Chest Stretch - 45s", "Child's Pose - 60s"]
  };
}
