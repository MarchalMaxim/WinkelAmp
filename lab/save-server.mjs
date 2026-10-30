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
      all[j.browser || 'unknown'] = { at: new Date().toISOString(), ratings: j.ratings, params: j.params };
      writeFileSync(FILE, JSON.stringify(all, null, 1));
      res.end('ok');
    } catch (e) { res.statusCode = 400; res.end(String(e)); }
  });
}).listen(5174, () => console.log('saving ratings to', FILE));
