/**
 * Where the phone apps (Android/iOS) load exercise videos from.
 *
 * The website serves clips from its own videos/ folder. The phone apps don't bundle the clips
 * (that would add ~100 MB to the download), so they stream them from the live website instead.
 * Set this to your GitHub Pages address, ending in a slash.
 */
export const REMOTE_SITE_URL = "https://YOUR-GITHUB-USERNAME.github.io/OmniPathWorkout/";
