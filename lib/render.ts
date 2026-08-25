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
 * Tell @sparticuz/chromium it is on Lambda, because Vercel will not.
 *
 * That package ships Chromium and, separately, the shared libraries Amazon
 * Linux does not carry — libnss3 among them. It only unpacks those libraries,
 * and only sets LD_LIBRARY_PATH to point at them, when it believes it is
 * running on Lambda. It decides that by reading AWS_EXECUTION_ENV,
 * AWS_LAMBDA_JS_RUNTIME or CODEBUILD_BUILD_IMAGE, and Vercel sets none of the
 * three.
 *
 * So the browser unpacked, launched, and died on
 * `libnss3.so: cannot open shared object file` — the binary was always there,
 * the libraries beside it never were. The first real run failed here, four
 * times, and looked from the outside like a job that simply stopped.
 *
 * The runtime version is derived rather than hardcoded because it selects
 * which library set is unpacked: Node 20 and 22 are Amazon Linux 2023, and
 * anything older is AL2. Guessing wrong swaps one missing-library error for
 * another. `??=` leaves a real value alone if the platform ever sets one.
 */
if (process.env.VERCEL && !process.env.AWS_EXECUTION_ENV) {
  const major = Number(process.versions.node.split('.')[0]) || 20;
  process.env.AWS_LAMBDA_JS_RUNTIME ??= `nodejs${major}.x`;
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
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
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
