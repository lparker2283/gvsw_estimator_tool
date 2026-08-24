/**
 * Offline smoke test — no API keys, no network.
 *
 * Renders the brief from two fixtures on purpose. One job has an unpriced item
 * and no total; the other is fully priced and needs no equipment at all. The
 * documents were previously written against the first kind and asserted its
 * details on every job, so rendering only one fixture is how that got missed.
 *
 * Run: npm run smoke
 */
import fs from 'node:fs';
const { buildDocuments } = await import('../lib/docs/index.ts');

const cases = [
  ['chimney (access unpriced)', './fixtures/job.json', './fixtures/extraction.json'],
  ['front steps (fully priced)', './fixtures/job-simple.json', './fixtures/extraction-simple.json'],
];

fs.mkdirSync('./out', { recursive: true });

for (const [label, specPath, exPath] of cases) {
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const ex = JSON.parse(fs.readFileSync(exPath, 'utf8'));
  const docs = await buildDocuments(spec, ex, 'smoke test transcript');
  for (const d of docs) {
    fs.writeFileSync(`./out/${d.filename}`, d.pdf);
    console.log('✓', label.padEnd(30), d.filename, (d.pdf.length / 1024).toFixed(0) + 'kb');
  }
}
