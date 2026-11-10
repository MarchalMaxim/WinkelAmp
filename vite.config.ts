import { defineConfig } from 'vite';
import { studioApi } from './scripts/studio-api';

export default defineConfig({
  base: './',
  server: { host: true },
  // The studio's dev API: songs, packs and shows on disk.
  plugins: [studioApi()],
});
