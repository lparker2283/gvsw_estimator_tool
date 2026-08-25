/**
 * HTML -> PDF. PDF, not .docx, because the reMarkable reads PDF and EPUB only —
 * a Word file is not a thing Dan can annotate on the device he actually uses.
 * Runs headless Chromium: @sparticuz/chromium on Vercel, local Chrome in dev.
 */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const PDF_OPTIONS = {
  format: 'letter' as const,
  printBackground: true,
  margin: { top: '0.7in', right: '0.75in', bottom: '0.6in', left: '0.75in' },
};

async function launch() {
  const local = process.env.NODE_ENV === 'development';
  return puppeteer.launch(
    local
      ? { executablePath: process.env.LOCAL_CHROME_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] }
      : { args: chromium.args, executablePath: await chromium.executablePath(), headless: true }
  );
}

/**
 * Render several documents in ONE browser.
 *
 * `buildDocuments` used to map four documents through `Promise.all`, and each
 * call launched its own Chromium — so a single serverless invocation started
 * four browsers at once, which does not fit in the memory a Vercel function
 * gets. Collapsing the outputs to one document already removed that, by
 * accident; this removes it on purpose, so that putting the client-facing pair
 * back is a line in an array rather than a second browser in the same lambda.
 *
 * One browser, one page at a time. Sequential is correct here — the work is
 * memory-bound rather than latency-bound, and a second concurrent page buys a
 * couple of seconds in exchange for the failure above.
 */
export async function renderMany(htmls: string[]): Promise<Buffer[]> {
  if (!htmls.length) return [];
  const browser = await launch();
  try {
    const out: Buffer[] = [];
    for (const html of htmls) {
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        out.push(Buffer.from(await page.pdf(PDF_OPTIONS)));
      } finally {
        await page.close();
      }
    }
    return out;
  } finally {
    await browser.close();
  }
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  return (await renderMany([html]))[0];
}
