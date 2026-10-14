OmniPath Workout
A React + Vite workout generator and tracker, deployed to GitHub Pages. It uses Firebase (Auth and Realtime Database) for accounts and sync, and Capacitor for the future iOS/Android apps.
Run it
```bash
npm install
npm run dev      # local dev server
npm test         # generator/progression/plan tests (no browser needed)
npm run lint
npm run build    # production build in dist/ (GitHub Actions does this on push to main)
```
Where things live
You want to change…	Edit
The exercise library	`src/data/exercises.json`
Which muscle group a target belongs to, and what each split must include	`src/data/muscleGroups.json`
Warm-ups and cool-down stretches	`src/data/warmups.json`
Calisthenics skill trees	`src/data/calisthenicsTrees.json`
Injury filters and prehab drills	`src/data/injuries.json`
How exercises are picked and balanced	`src/services/workoutEngine.js`
Sets, reps, weights and progression schemes	`src/services/progression.js` (scheme tables at the top)
Rest timer and sound	`src/services/timerEngine.js`
Multi-week plans	`src/services/planBuilder.js`
Saving, Firebase sync and public programs	`src/services/dbService.js`
Screens	`src/components/*.jsx` (state is wired together in `src/App.jsx`)
Each data file has a `_readme` at the top that explains its fields.
How a workout is generated
Split. `upper_lower` and `ppl` rotate. The next split follows your last logged workout.
Pool. Injury filter, then your equipment. For calisthenics, the skill-tree gate also applies.
Balance. Standard and Powerlifter sessions open with a barbell main lift. Then every `required` muscle group in `muscleGroups.json` gets at least one exercise, and the first pick for a big group is a compound movement. Extra slots follow the `fill` order. If a group has no available exercise, the session shows a red "No exercise available for…" notice.
Warm-up and cool-down. General warm-up, any injury prehab, then one warm-up and one stretch for each muscle group in the session.
Sets. `progression.js` sets the sets, reps and weight for each exercise.
Progression schemes
These apply to barbell main lifts (bench, squat, deadlift, OHP and the variations listed in `MAIN_LIFT_RULES`). Everything else uses double progression: add reps until you reach the top of the range, then add 5 lbs.
Linear. Starts at 70% of 1RM for 3×8 (Powerlifter: 75% for 3×5). Add 5 lbs (upper) or 10 lbs (lower) after a session where you hit every rep. Repeat the weight after a miss.
5/3/1. Uses a training max of 90% of 1RM. Weeks run 5s, 3s, 5/3/1, then a deload. The last set is AMRAP.
Juggernaut (simplified). 16 weeks in 10s, 8s, 5s and 3s waves. Each wave runs Accumulation, Intensification, Realization (AMRAP) and Deload.
Conjugate. Max Effort and Dynamic Effort days alternate for each upper/lower region. Speed work runs as a 3-week wave at 50%, 55% and 60%.
Program Builder. Main lifts start at 70% of 1RM and add your "Weekly Progression %" each week.
The cycle week for quick-generated workouts counts from the date you picked the scheme. Use Restart cycle to reset it. Plans use their own week numbers.
Calisthenics skill trees
Workouts include skills you've checked as mastered plus the next step in each tree. Locked skills never appear. Bodyweight exercises outside the trees are capped at the difficulty of the hardest skill you've unlocked in the related tree, so advanced moves can't slip in early.
Rest timer
Default (foreground). Beeps when the timer ends and mixes with your music. It only rings while the tab is open, and the iPhone silent switch mutes it.
Settings → Background timer alert. When the timer starts, it plays an audio track of silence followed by a beep. This rings in the background, on the lock screen and on silent. Phones treat it like music, so it may pause Spotify or Apple Music during the rest.
For the Capacitor app, `@capacitor/local-notifications` can schedule a native notification instead. That's the best long-term option.
Public programs (Program Builder)
Check Make this program public in the wizard, or toggle it on an existing program. Logged-in users can then browse it under Community Programs and copy it into their own Program Builder. Authors are shown by display name only, never by email. The public copy updates automatically as you edit.
⚠️ Publish the database rules
Public programs need the rules in `database.rules.json`. They also lock `users/{uid}` so each user can only read and write their own data. Publish them using one of these:
Firebase console → Realtime Database → Rules → paste the file → Publish, or
`npm i -g firebase-tools && firebase login && firebase deploy --only database`
If your database isn't in the US region, update `databaseURL` in `src/config/firebase.js`.
