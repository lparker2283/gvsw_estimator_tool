import { Resend } from 'resend';
import type { Doc } from './docs';
import { brandFor } from './brand';
import { highlights, daySpan, dollars, effectiveRateLine } from './highlights';

// Built on first use: the SDK throws without a key, and Next imports this
// module while collecting page data during the build, where no key exists.
let _resend: Resend | null = null;
function resend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM = process.env.MAIL_FROM!;

const wrap = (body: string, brandKey?: string) => {
  const b = brandFor(brandKey);
  return `
<div style="font-family:${b.font};font-size:16px;line-height:1.6;color:${b.ink};max-width:440px">
  <div style="font-size:11px;letter-spacing:.2em;color:${b.accent};font-weight:700;margin-bottom:18px">
    ${b.wordmark}</div>${body}</div>`;
};

export async function sendQuestionsEmail(
  o: { to: string; count: number; link: string; transcript: string; brand?: string },
) {
  const b = brandFor(o.brand);
  const noun = o.count === 1 ? 'question' : 'questions';
  await resend().emails.send({
    from: FROM, to: o.to,
    // The escape hatch used to be explained here, ahead of a button that leads
    // to a page where it is visibly one of the options. Reassurance repeated is
    // reassurance doubted; the page carries it structurally, so this is just
    // the count and the link.
    subject: `Got your memo — ${o.count} ${noun}`,
    html: wrap(`
      <p>Transcribed. <b>${o.count} ${noun}</b> and I can price it.</p>
      <p style="margin:26px 0">
        <a href="${o.link}" style="display:inline-block;background:${b.accent};color:${b.surface};text-decoration:none;
          padding:15px 30px;border-radius:8px;font-weight:600;font-size:17px">Answer the ${noun}</a></p>
      <details style="margin-top:24px">
        <summary style="font-size:13px;color:${b.muted};cursor:pointer">What I heard</summary>
        <p style="font-size:13px;color:${b.muted};font-style:italic;margin-top:10px">${o.transcript}</p>
      </details>`, o.brand),
  });
}

/**
 * The highlights, in the body of the email, and the same content attached as a
 * page he can mark up.
 *
 * Both matter and they are not redundant. The email is what he reads standing at
 * the truck; the PDF is what he marks up at the kitchen table, and the marks are
 * the training data. Rendering both from one structure is what stops his pencil
 * landing on a claim the email never made.
 */
export async function deliver(
  o: { to: string; docs: Doc[]; spec: any; extraction?: any; review: boolean; brand?: string },
) {
  const { subject, html } = deliveryEmail(o.spec, o.extraction, o.review, o.brand);
  await resend().emails.send({
    from: FROM, to: o.to, subject, html,
    attachments: o.docs.map(d => ({ filename: d.filename, content: d.pdf.toString('base64') })),
  });
}

/**
 * The body, built apart from the sending of it.
 *
 * Split out so the email can be rendered and looked at without a live job, an
 * API key, or a memo. An email nobody can preview is an email whose first
 * reader is Dan.
 *
 * IT SHOULD LOOK LIKE A PERSON SENT IT.
 *
 * The previous version had a wordmark, an accent colour, five uppercase
 * letter-spaced headings, a tinted callout box with a coloured left border, a
 * bold CRITICAL tag and four type sizes — brand furniture around a message that
 * is two hundred words long. It read as a system notification, and the eye had
 * nowhere to land.
 *
 * So: Gmail's own font at one size, black text, one grey for asides, bold for
 * emphasis and nothing else. No boxes, no rules, no colour. The three things he
 * needs off a phone screen are the price, that it is incomplete, and what to do
 * next, and they are the only bold lines in it.
 */
export function deliveryEmail(
  spec: any, extraction?: any, review = false, brandKey?: string,
): { subject: string; html: string } {
  const H = highlights(spec);
  const findings: any[] = (extraction?.findings || []).filter((f: any) => f.severity !== 'low');

  const both = H.range && H.range.low.total != null && H.range.high.total != null;
  const partial = !!(H.range && (H.range.low.partial || H.range.high.partial));

  const GREY = '#666';
  const p = 'margin:0 0 14px';
  const li = (t: string) => `<li style="margin-bottom:8px">${t}</li>`;

  /**
   * Two sentences, and they carry the first two of the three things: how he
   * would charge it with both ends and a duration, and — its own sentence,
   * because it is the one people skim past — that the number is incomplete.
   */
  const headline = [
    // The human opener rides on the front of the price rather than sitting above
    // it in its own paragraph. Warmth costs four words here; as a paragraph of
    // its own it cost a block of screen before the number he opened this for.
    `Here's where I'd start:`,
    H.model ? `<b>${H.model.recommendation.replace(/\.$/, '')}</b>` : '',
    both ? `— roughly <b>${dollars(H.range!.low.total ?? null)} to ${dollars(H.range!.high.total ?? null)}</b>` : '',
    H.duration ? `over <b>${daySpan(H.duration)}</b> on site` : '',
  ].filter(Boolean).join(' ') + '.';

  /**
   * Next steps, in the order he would do them, and always ending the same way:
   * the marked-up page is the last step of every job, and it is the only step
   * that makes the next estimate better.
   */
  const steps = [...H.nextSteps, 'Mark up the attached brief and reply with it — I read the marks and log them.'];

  return {
    // The proposal number is in the subject on purpose: it is how a reply
    // carrying the marked-up page finds its way back to the right job.
    subject: review
      ? `[REVIEW] ${H.proposalNo} — ready for Dan`
      : `${H.proposalNo} — ${H.projectName}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222;max-width:600px">
      ${review ? `<p style="${p};color:${GREY}">Review copy — nothing has gone to Dan.</p>` : ''}

      <p style="${p}">${headline}</p>

      ${partial ? `<p style="${p}"><b>That number is not complete yet</b> — ${
        H.range?.equipment_note || 'some of the job is still unpriced.'}</p>` : ''}

      ${H.effectiveRate ? `<p style="${p}">${effectiveRateLine(H.effectiveRate)}</p>` : ''}

      ${findings.length ? `
        <p style="${p}"><b>Worth knowing</b></p>
        <ul style="margin:0 0 14px;padding-left:22px">${findings.map((f: any) =>
          li(`${f.finding} — ${f.implication}`)).join('')}</ul>` : ''}

      <p style="${p}"><b>Next steps</b></p>
      <ol style="margin:0 0 14px;padding-left:22px">${steps.map(li).join('')}</ol>

      ${review && spec._validation?.length
        ? `<p style="${p};color:${GREY}">Check ${spec._validation.length}: ${spec._validation.join(' · ')}</p>` : ''}

      <p style="${p};color:${GREY}">Full breakdown attached, and in Drive.</p>
    </div>`,
  };
}

/**
 * What the tool understood from a marked-up page.
 *
 * Deliberately a receipt and not a discussion. He has already spent the effort
 * of marking the page; asking him to now read a page about his own marks is how
 * a feedback loop acquires a cost and then stops being used. If it misread
 * something he will say so, and that reply is itself a correction.
 */
export async function sendCorrectionsEmail(
  o: { to: string; proposalNo: string; reading: { verdict: string; marks: any[]; summary: string }; brand?: string },
) {
  const b = brandFor(o.brand);
  const marks = o.reading.marks || [];

  const counts = marks.reduce((acc: Record<string, number>, m) => {
    acc[m.kind] = (acc[m.kind] || 0) + 1;
    return acc;
  }, {});
  const tally = Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ');

  const body = o.reading.verdict === 'unreadable'
    ? `<p>I could not read the marks on ${o.proposalNo}. Nothing has been logged.</p>
       <p style="font-size:14px;color:${b.muted}">A photograph of the page usually works better than a scan.</p>`
    : marks.length === 0
      ? `<p><b>${o.proposalNo}</b> — no changes. Logged as approved.</p>`
      : `<p><b>${o.proposalNo}</b> — logged ${marks.length} change${marks.length === 1 ? '' : 's'}${tally ? ` (${tally})` : ''}.</p>
         <table style="font-size:14px;border-collapse:collapse;margin-top:14px">
           ${marks.map(m => `<tr>
             <td style="padding:5px 12px 5px 0;color:${b.muted};white-space:nowrap">${m.line_ref || '—'}</td>
             <td style="padding:5px 12px 5px 0;color:${b.muted}">${m.kind}</td>
             <td style="padding:5px 0"><s style="color:${b.muted}">${m.tool_value || ''}</s> ${m.dan_value || ''}</td>
           </tr>`).join('')}
         </table>
         <p style="font-size:14px;color:${b.muted};margin-top:18px">Anything I read wrong, just reply.</p>`;

  await resend().emails.send({
    from: FROM, to: o.to,
    subject: `${o.proposalNo} — ${marks.length ? `${marks.length} correction${marks.length === 1 ? '' : 's'} logged` : 'no changes'}`,
    html: wrap(body, o.brand),
  });
}
