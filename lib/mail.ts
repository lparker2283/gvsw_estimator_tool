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
 * API key, or a memo — the same reason the documents have a smoke test. An email
 * nobody can preview is an email whose first reader is Dan.
 *
 * It used to be the document again, in HTML: every section, a four-row range
 * table, the rate-card key under each objection. Two renderings of the same
 * page, one of which he could not mark up. So the email says the thing out loud
 * instead — how he would charge it, the two ends of the range, what is missing
 * from the number, how long, what to gather before quoting, and what else is
 * worth knowing. The breakdown is attached, and that is where detail belongs.
 */
export function deliveryEmail(
  spec: any, extraction?: any, review = false, brandKey?: string,
): { subject: string; html: string } {
  const b = brandFor(brandKey);
  const H = highlights(spec);

  const findings: any[] = (extraction?.findings || []).filter((f: any) => f.severity !== 'low');

  // Validation is the tool doubting its own arithmetic. It belongs to whoever is
  // reviewing, not to the mason, and it is off the document entirely now.
  const problems = review && spec._validation?.length
    ? `<p style="color:#8a3b2a;font-size:14px"><b>Check ${spec._validation.length}:</b><br>${spec._validation.join('<br>')}</p>` : '';

  const h2 = `font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${b.muted};font-weight:700;margin:24px 0 6px`;
  const li = (t: string) => `<li style="margin-bottom:5px">${t}</li>`;

  /**
   * The opening, assembled rather than written, because every figure in it is one
   * this job produced: how to charge, the two ends, what is not in either end
   * yet, and how long. A range that silently omits the unquoted line is the same
   * failure as a total that does.
   *
   * The recommendation is quoted whole and never bent into the sentence around
   * it. It is written as a decision in its own words — "Day rate. Not per square
   * foot." — and lowercasing that to splice it after "I would price this" gave
   * "price this day rate. not per square foot", which is neither his sentence nor
   * a grammatical one. So it stands on its own line, as it was written.
   */
  const money2 = (n: any) => dollars(n ?? null);
  const both = H.range && H.range.low.total != null && H.range.high.total != null;
  const partial = !!(H.range && (H.range.low.partial || H.range.high.partial));

  const figures = [
    both ? `Charging anywhere from <b>${money2(H.range!.low.total)}</b> to <b>${money2(H.range!.high.total)}</b>` : '',
    partial ? ', <b>plus what is still unpriced</b>' : '',
    H.duration ? `${both ? ', and booking' : 'Booking'} <b>${daySpan(H.duration)}</b> on site` : '',
  ].filter(Boolean).join('');

  return {
    // The proposal number is in the subject on purpose: it is how a reply
    // carrying the marked-up page finds its way back to the right job.
    subject: review
      ? `[REVIEW] ${H.proposalNo} — ready for Dan`
      : `${H.proposalNo} — ${H.projectName}`,
    html: wrap(`
      ${review ? '<p style="color:#8a3b2a"><b>Review copy.</b> Nothing has gone to Dan.</p>' : ''}

      <p style="margin:0 0 10px;font-size:17px;line-height:1.55">Based on your memo and your
        answers to my questions, here is how I would price it.</p>

      ${H.model ? `<p style="font-size:19px;font-weight:700;color:${b.inkStrong};margin:0 0 8px">${H.model.recommendation}</p>` : ''}

      ${figures ? `<p style="margin:0 0 12px;font-size:17px;line-height:1.55">${figures}.</p>` : ''}

      ${H.model?.why ? `<p style="margin:0 0 12px">${H.model.why}</p>` : ''}

      ${partial && H.range?.equipment_note
        ? `<p style="margin:0 0 12px;color:${b.muted}">${H.range.equipment_note}</p>` : ''}

      ${H.effectiveRate ? `<p style="margin:16px 0;padding:12px 14px;background:${b.accentSoft};
          border-left:3px solid ${b.accent};font-weight:700">${effectiveRateLine(H.effectiveRate)}</p>` : ''}

      ${H.blockers.length ? `
        <div style="${h2}">Before quoting this, gather</div>
        <ul style="margin:6px 0;padding-left:20px">${H.blockers.map(x =>
          li(`<b>${x.item}</b>${x.critical ? ' <span style="color:' + b.accent + ';font-size:11px;letter-spacing:.1em">CRITICAL</span>' : ''} — ${x.why}`)).join('')}</ul>` : ''}

      ${H.nextSteps.length ? `
        <ul style="margin:6px 0;padding-left:20px;color:${b.muted}">${H.nextSteps.map(li).join('')}</ul>` : ''}

      ${findings.length ? `
        <div style="${h2}">Other things worth knowing</div>
        <ul style="margin:6px 0;padding-left:20px">${findings.map((f: any) =>
          li(`${f.finding} — ${f.implication}`)).join('')}</ul>` : ''}

      ${problems}

      <p style="margin-top:26px;padding-top:16px;border-top:1px solid ${b.line}">
        Full breakdown attached, and in ${b.driveFolder}. Mark it up and reply with it attached — I read the marks and log them.</p>`, brandKey),
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
