/**
 * Offline smoke test — no API keys, no network.
 * Renders every document template from a fixture so layout breaks are caught
 * before they reach Dan. Run: npm run smoke
 */
import fs from 'node:fs';
const spec = JSON.parse(fs.readFileSync('./fixtures/job.json', 'utf8'));
const ex   = JSON.parse(fs.readFileSync('./fixtures/extraction.json', 'utf8'));
const { buildDocuments } = await import('../lib/docs/index.js');
const docs = await buildDocuments(spec, ex, 'smoke test transcript');
fs.mkdirSync('./out', { recursive: true });
for (const d of docs) { fs.writeFileSync(`./out/${d.filename}`, d.pdf); console.log('✓', d.filename, (d.pdf.length/1024).toFixed(0)+'kb'); }
