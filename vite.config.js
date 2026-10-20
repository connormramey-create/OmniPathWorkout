import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const VIDEO_DIR = path.resolve('public/videos');
const VIDEO_EXT = /\.(mp4|webm)$/i;
const VIRTUAL_ID = 'virtual:exercise-videos';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/** Lists the clips in public/videos, e.g. { ex_001: "ex_001.mp4" }. */
function scanVideos() {
  if (!fs.existsSync(VIDEO_DIR)) return {};
  const map = {};
  for (const file of fs.readdirSync(VIDEO_DIR)) {
    if (VIDEO_EXT.test(file)) map[file.replace(VIDEO_EXT, '')] = file;
  }
  return map;
}

/**
 * Exercise demo videos: drop "<exercise id>.mp4" into public/videos and it shows up in the app.
 * - `import videos from "virtual:exercise-videos"` gives the list found at build time.
 * - The build also writes videos/index.json so the phone apps can pick up new clips
 *   from the website without an app update.
 */
function exerciseVideos() {
  return {
    name: 'exercise-videos',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id === RESOLVED_ID) return `export default ${JSON.stringify(scanVideos())};`;
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'videos/index.json', source: JSON.stringify(scanVideos()) });
    },
    configureServer(server) {
      // While `npm run dev` is running, adding or removing a clip refreshes the page.
      server.watcher.add(VIDEO_DIR);
      const refresh = (file) => {
        if (!file.startsWith(VIDEO_DIR)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    }
  };
}

export default defineConfig({
  plugins: [react(), exerciseVideos()],
  base: './'
});
