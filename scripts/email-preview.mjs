/**
 * Renders the delivery email from a fixture — no keys, no network, nothing sent.
 *
 * The email is half the deliverable and until now it was the half nobody could
 * look at before Dan did. Run: npm run email
 */
import fs from 'node:fs';
const { deliveryEmail } = await import('../lib/mail.ts');
const { validate } = await import('../lib/price.ts');

const cases = [
  ['chimney', './fixtures/job.json', './fixtures/extraction.json'],
  ['steps', './fixtures/job-simple.json', './fixtures/extraction-simple.json'],
];

fs.mkdirSync('./out', { recursive: true });

for (const [label, specPath, exPath] of cases) {
  const spec = validate(JSON.parse(fs.readFileSync(specPath, 'utf8')));
  const ex = JSON.parse(fs.readFileSync(exPath, 'utf8'));
  const { subject, html } = deliveryEmail(spec, ex);
  // A phone, held at the truck. That is the only viewport this has to survive.
  fs.writeFileSync(`./out/email-${label}.html`,
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
    `<title>${subject}</title></head>` +
    `<body style="margin:0;background:#f4f2ee;padding:22px 16px">` +
    `<div style="max-width:472px;margin:0 auto;background:#fff;padding:20px 16px;border-radius:10px">` +
    `<div style="font:600 13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;` +
    `color:#807b72;padding-bottom:14px;margin-bottom:6px;border-bottom:1px solid #e2ddd3">Subject: ${subject}</div>` +
    html + `</div></body></html>`);
  console.log('✓', `out/email-${label}.html`, '—', subject);
}
