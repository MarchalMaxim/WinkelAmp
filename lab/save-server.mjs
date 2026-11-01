// Throwaway: receives the lab page's ratings + slider settings from any browser and writes them to a file Claude reads.
//   node lab/save-server.mjs   (listens on http://localhost:5174)
import { createServer } from 'node:http';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ratings.json');
createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method === 'GET') { res.setHeader('content-type', 'application/json'); return res.end(existsSync(FILE) ? readFileSync(FILE) : '{}'); }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    try {
      const j = JSON.parse(body);
      // One entry per browser, so ratings from Chrome and from Claude's pane don't overwrite each other.
      const all = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
      const key = j.browser || 'unknown', old = all[key];
      // Merge widget by widget: a fresh browser, or the same Chrome on another port (another origin, so its own nearly
      // empty localStorage, e.g. a second lab), posts only what it has, and must never wipe ratings made elsewhere.
      // A rating set here wins; one left empty here keeps the saved one.
      const set = Object.fromEntries(Object.entries(j.ratings || {}).filter(([, v]) => v));
      all[key] = { at: new Date().toISOString(), ratings: { ...(old?.ratings || {}), ...set }, params: { ...(old?.params || {}), ...(j.params || {}) } };
      writeFileSync(FILE, JSON.stringify(all, null, 1));
      res.end('ok');
    } catch (e) { res.statusCode = 400; res.end(String(e)); }
  });
}).listen(5174, () => console.log('saving ratings to', FILE));
