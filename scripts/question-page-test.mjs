/**
 * Click through the question page against a stubbed API.
 *
 * The page had never been driven end to end before it went to a real user, and
 * the bug that found was invisible in the code and obvious in ten seconds of
 * clicking: submitting left the question screen up with every option silently
 * disabled, and `← back` still worked, so pressing it landed on an earlier
 * question that was also dead. It looked broken because it looked exactly like
 * a broken page.
 *
 * The walk below is deliberately the awkward one — answer, go back, re-answer,
 * submit — because the tidy path never showed it.
 *
 *   npx next dev -p 3111        (in one shell)
 *   npm run qtest               (slow submit, succeeds)
 *   npm run qtest -- fail       (submit returns 500)
 *
 * Screenshots land in out/.
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const QUESTIONS = [
  { id: 'scope', q: 'What are we doing to it?', why: 'Drives every line below.',
    options: ['Repoint the joints', 'Rebuild above the roof', "Don't know yet — measure on site"] },
  { id: 'height', q: 'How high is the work?', why: 'Over 12 ft changes the access line.',
    unit: 'feet', options: ['Under 12 ft', 'Over 20 ft (recommended)', "Don't know yet — measure on site"] },
  { id: 'access', q: 'Can a truck reach it?', why: 'Decides lift versus scaffold.',
    options: ['Yes, driveway', 'No, narrow path', "Don't know yet — measure on site"] },
];

const mode = process.argv[2] || 'slow';   // slow | fail

// Same resolution order as lib/render.ts — the hardcoded path is a cloud
// sandbox's, and this script is meant to be run on a laptop.
const CHROME = process.env.LOCAL_CHROME_PATH
  || process.env.PUPPETEER_EXECUTABLE_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// The screenshots below write here. smoke.mjs makes this directory; this script
// used to assume it already existed and threw on the first shot in a clean checkout.
fs.mkdirSync('./out', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 860, deviceScaleFactor: 2 });
await page.setRequestInterception(true);

page.on('request', async r => {
  const url = r.url();
  if (url.includes('/api/job/')) {
    return r.respond({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ questions: QUESTIONS, status: 'awaiting_answers', brand: 'gvsw' }) });
  }
  if (url.includes('/api/submit')) {
    // The real thing takes 30-90s. Six is enough to catch the frozen window.
    await new Promise(s => setTimeout(s, 6000));
    if (mode === 'fail') {
      return r.respond({ status: 500, contentType: 'application/json',
        body: JSON.stringify({ error: 'pricing failed: rate card key not found' }) });
    }
    return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  }
  return r.continue();
});

const shot = (n) => page.screenshot({ path: `out/q-${mode}-${n}.png` });
const clickFirstOption = async () => {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => !/why\?|type a|← back/i.test(x.innerText));
    b?.click();
  });
};

await page.goto('http://localhost:3111/q/testtoken', { waitUntil: 'networkidle0' });
await new Promise(s => setTimeout(s, 600));
await shot('1-first-question');

await clickFirstOption();                       // q1
await new Promise(s => setTimeout(s, 300));
await clickFirstOption();                       // q2

// Go back, then forward again — the path she was on when it locked up.
await new Promise(s => setTimeout(s, 300));
await page.evaluate(() => [...document.querySelectorAll('button')].find(x => /← back/.test(x.innerText))?.click());
await new Promise(s => setTimeout(s, 300));
await shot('2-after-back');
console.log('after back, heading:', await page.$eval('h1', h => h.innerText));

await clickFirstOption();                       // re-answer q2
await new Promise(s => setTimeout(s, 300));
await clickFirstOption();                       // q3 -> submits
await new Promise(s => setTimeout(s, 900));
await shot('3-submitting');
console.log('while submitting, heading:', await page.$eval('h1', h => h.innerText));
console.log('back button present while submitting:',
  await page.evaluate(() => [...document.querySelectorAll('button')].some(x => /← back/.test(x.innerText))));

await new Promise(s => setTimeout(s, 6500));
await shot('4-result');
console.log('final heading:', await page.$eval('h1', h => h.innerText));
console.log('retry button present:',
  await page.evaluate(() => [...document.querySelectorAll('button')].some(x => /Try again/.test(x.innerText))));

await browser.close();
