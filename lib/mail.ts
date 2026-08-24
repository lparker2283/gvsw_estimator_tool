import { Resend } from 'resend';
import type { Doc } from './docs';
import { brandFor } from './brand';
import { highlights, daySpan, dollars, effectiveRateLine, ROWS } from './highlights';

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
 * the truck — enough to know how to charge it and what is still open, without
 * opening anything. The PDF is what he marks up at the kitchen table, and the
 * marks are the training data. Rendering both from one structure is what stops
 * his pencil landing on a claim the email never made.
 */
export async function deliver(o: { to: string; docs: Doc[]; spec: any; review: boolean; brand?: string }) {
  const { subject, html } = deliveryEmail(o.spec, o.review, o.brand);
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
 */
export function deliveryEmail(spec: any, review = false, brandKey?: string): { subject: string; html: string } {
  const b = brandFor(brandKey);
  const H = highlights(spec);
  const o = { spec, review, brand: brandKey };
  const problems = o.spec._validation?.length
    ? `<p style="color:#8a3b2a"><b>Check ${o.spec._validation.length}:</b><br>${o.spec._validation.join('<br>')}</p>` : '';

  const h2 = `font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${b.muted};font-weight:700;margin:26px 0 6px`;
  const lead = `font-size:17px;font-weight:700;color:${b.inkStrong};margin:0 0 6px`;
  const li = (s: string) => `<li style="margin-bottom:4px">${s}</li>`;

  const rangeRows = ROWS.map(({ key, label }) => `
    <tr>
      <td style="padding:6px 0;color:${b.ink}">${label}</td>
      <td style="padding:6px 0 6px 18px;text-align:right;white-space:nowrap">${dollars(H.range!.low[key] as any)}</td>
      <td style="padding:6px 0 6px 18px;text-align:right;white-space:nowrap">${dollars(H.range!.high[key] as any)}</td>
    </tr>`).join('');

  return {
    // The proposal number is in the subject on purpose: it is how a reply
    // carrying the marked-up page finds its way back to the right job.
    subject: o.review
      ? `[REVIEW] ${H.proposalNo} — ready for Dan`
      : `${H.proposalNo} — ${H.projectName}`,
    html: wrap(`
      ${o.review ? '<p style="color:#8a3b2a"><b>Review copy.</b> Nothing has gone to Dan.</p>' : ''}

      ${H.model ? `
        <div style="${h2}">How to charge it</div>
        <p style="${lead}">${H.model.recommendation}</p>
        <p style="margin:0">${H.model.why}</p>` : ''}

      ${H.duration ? `
        <div style="${h2}">How long</div>
        <p style="${lead}">${daySpan(H.duration)} on site.</p>
        ${H.duration.drivers?.length ? `<ul style="margin:6px 0;padding-left:20px">${H.duration.drivers.map(li).join('')}</ul>` : ''}` : ''}

      ${H.blockers.length ? `
        <div style="${h2}">Before you commit to a number</div>
        ${H.blockers.map(x => `
          <p style="margin:0 0 4px"><b>${x.item}</b> — ${x.why}</p>
          <p style="margin:0 0 14px;color:${b.muted}">${x.resolves_by}</p>`).join('')}` : ''}

      ${H.range ? `
        <div style="${h2}">The range</div>
        <table style="width:100%;border-collapse:collapse;font-size:15px">
          <tr><td></td>
            <td style="padding:0 0 4px 18px;text-align:right;font-size:11px;letter-spacing:.12em;color:${b.muted}">LOW</td>
            <td style="padding:0 0 4px 18px;text-align:right;font-size:11px;letter-spacing:.12em;color:${b.muted}">HIGH</td></tr>
          ${rangeRows}
          <tr><td style="padding:10px 0 0;border-top:1.5px solid ${b.line};font-weight:700">${H.range.low.partial || H.range.high.partial ? 'So far' : 'Range'}</td>
            <td style="padding:10px 0 0 18px;border-top:1.5px solid ${b.line};text-align:right;font-weight:700;font-size:19px">${dollars(H.range.low.total ?? null)}</td>
            <td style="padding:10px 0 0 18px;border-top:1.5px solid ${b.line};text-align:right;font-weight:700;font-size:19px">${dollars(H.range.high.total ?? null)}</td></tr>
        </table>
        ${H.range.equipment_note ? `<p style="font-size:13px;color:${b.muted};margin:8px 0 0">${H.range.equipment_note}</p>` : ''}
        ${H.effectiveRate ? `<p style="margin:16px 0 0;padding:12px 14px;background:${b.accentSoft};
            border-left:3px solid ${b.accent};font-weight:700">${effectiveRateLine(H.effectiveRate)}</p>` : ''}
        ${H.range.swing?.length ? `
          <div style="${h2}">What moves it</div>
          <ul style="margin:6px 0;padding-left:20px">${H.range.swing.map(li).join('')}</ul>` : ''}` : ''}

      ${H.explanation || H.objections.length ? `
        <div style="${h2}">When they push back</div>
        ${H.explanation ? `<p style="margin:0 0 14px">${H.explanation}</p>` : ''}
        ${H.objections.map(x => `
          <p style="margin:0 0 3px"><b>“${x.objection}”</b></p>
          <p style="margin:0 0 4px">${x.response}</p>
          <p style="margin:0 0 14px;font-size:12px;color:${b.muted}">${x.grounded_in}</p>`).join('')}` : ''}

      ${problems}

      <p style="margin-top:26px;padding-top:16px;border-top:1px solid ${b.line}">
        Full page attached, and in ${b.driveFolder}. Mark it up and reply with it attached — I read the marks and log them.</p>`, o.brand),
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
