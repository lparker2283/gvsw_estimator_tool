/**
 * HTML -> PDF. PDF, not .docx, because the reMarkable reads PDF and EPUB only —
 * a Word file is not a thing Dan can annotate on the device he actually uses.
 * Runs headless Chromium: @sparticuz/chromium on Vercel, local Chrome in dev.
 */
import puppeteer from 'puppeteer-core';

const PDF_OPTIONS = {
  format: 'letter' as const,
  printBackground: true,
  margin: { top: '0.7in', right: '0.75in', bottom: '0.6in', left: '0.75in' },
};

/**
 * Ask @sparticuz/chromium for the Amazon Linux 2023 libraries, always.
 *
 * The package ships Chromium and, separately, the shared libraries the base
 * image does not carry. It unpacks them, and points LD_LIBRARY_PATH at them,
 * only when it believes it is on Lambda — decided from AWS_EXECUTION_ENV,
 * AWS_LAMBDA_JS_RUNTIME or CODEBUILD_BUILD_IMAGE, none of which Vercel sets.
 * Without that, Chromium unpacked alone and died on a missing libnss3.
 *
 * Setting the variable opened the gate but exposed a second fault, because
 * there are two library sets and the package picks between them by string
 * match. `al2023.tar.br` carries the full NSS set — libnspr4, libplc4, libplds4
 * and the freebl pair. `al2.tar.br` carries six files and none of those,
 * because on real Lambda the AL2 image already provides them. Vercel's image
 * does not.
 *
 * The version is hardcoded rather than derived from `process.versions.node`,
 * which is what the previous attempt did and why the error moved from libnss3
 * to libnspr4 instead of going away. The package's check whitelists the exact
 * strings "20.x" and "22.x"; every other runtime, newer as well as older,
 * falls through to the six-file AL2 set. Deriving the truth therefore selects
 * the wrong archive on any runtime the package has not heard of, which is a
 * guarantee that this breaks again on the next Node release.
 *
 * `??=` leaves a real value alone if the platform ever starts setting one.
 */
if (process.env.VERCEL && !process.env.AWS_EXECUTION_ENV) {
  process.env.AWS_LAMBDA_JS_RUNTIME ??= 'nodejs22.x';
}

async function launch() {
  const local = process.env.NODE_ENV === 'development';
  if (local) {
    return puppeteer.launch({
      executablePath: process.env.LOCAL_CHROME_PATH || '/opt/pw-browsers/chromium',
      headless: true,
      args: ['--no-sandbox'],
    });
  }
  // Imported here, not at the top: the package decides whether to unpack its
  // libraries the moment it is first evaluated, so the environment above has to
  // be set before that happens. A static import is hoisted and would run first.
  const chromium = (await import('@sparticuz/chromium')).default;
  try {
    return await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } catch (err) {
    /**
     * Two rounds of this were diagnosed by reading a missing library name and
     * guessing which archive had been unpacked. The answer was in the runtime
     * the whole time, so it travels with the error now. `describe()` in the
     * submit route walks the cause chain, so both messages reach the ledger.
     */
    throw new Error(
      `chromium launch failed on node ${process.versions.node} · ` +
      `AWS_LAMBDA_JS_RUNTIME=${process.env.AWS_LAMBDA_JS_RUNTIME ?? 'unset'} · ` +
      `LD_LIBRARY_PATH=${process.env.LD_LIBRARY_PATH ?? 'unset'}`,
      { cause: err },
    );
  }
}

/**
 * Render several documents in ONE browser.
 *
 * `buildDocuments` used to map four documents through `Promise.all`, and each
 * call launched its own Chromium — four browsers in one invocation, which does
 * not fit in the memory a Vercel function gets. Collapsing the outputs to one
 * document already removed that by accident; this removes it on purpose, so
 * putting the client-facing pair back is a line in an array rather than a
 * second browser.
 *
 * One browser, one page at a time. Sequential is correct here — the work is
 * memory-bound rather than latency-bound.
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
