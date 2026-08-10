/**
 * HTML -> PDF. PDF, not .docx, because the reMarkable reads PDF and EPUB only —
 * a Word file is not a thing Dan can annotate on the device he actually uses.
 * Runs headless Chromium: @sparticuz/chromium on Vercel, local Chrome in dev.
 */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function htmlToPdf(html: string): Promise<Buffer> {
  const local = process.env.NODE_ENV === 'development';
  const browser = await puppeteer.launch(
    local
      ? { executablePath: process.env.LOCAL_CHROME_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] }
      : { args: chromium.args, executablePath: await chromium.executablePath(), headless: true }
  );
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return Buffer.from(await page.pdf({
      format: 'letter',
      printBackground: true,
      margin: { top: '0.7in', right: '0.75in', bottom: '0.6in', left: '0.75in' },
    }));
  } finally {
    await browser.close();
  }
}
