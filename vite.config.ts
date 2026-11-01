import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { studioApi } from './scripts/studio-api';

const page = (name: string) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  base: './',
  server: { host: true },
  // The studio's dev API (songs, packs, shows on disk); the static build has none and saves by download.
  plugins: [studioApi()],
  build: {
    // The studio bundles every lab widget's source (one ~750 kB chunk, by design: dist works without the lab).
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // The studio, the old app (microphone, MIDI, the WebGL stage) and the frame-by-frame render page.
      input: { index: page('index.html'), legacy: page('legacy.html'), render: page('render.html') },
    },
  },
});
