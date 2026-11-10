// Vitest's own config, with no imports from the repo on purpose: without it vitest loads vite.config.ts and with it the
// dev API plugin's whole import graph. `npm run check` runs the fast project; `npm test` runs both.
const SLOW = [
  'tests/ingest-v2.test.ts',
  'tests/ingest-cli.test.ts',
  'tests/ears-server.test.ts',
  'tests/ears-tools.test.ts',
  'tests/check-show.test.ts',
  'tests/muscriptor-config.test.ts',
  'tests/descriptors.test.ts',
];

export default {
  test: {
    projects: [
      { test: { name: 'fast', include: ['tests/**/*.test.ts'], exclude: SLOW } },
      { test: { name: 'slow', include: SLOW } },
    ],
  },
};
