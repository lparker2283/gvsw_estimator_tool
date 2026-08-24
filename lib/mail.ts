import { Resend } from 'resend';
import type { Doc } from './docs';
import { brandFor } from './brand';

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

export async function deliver(o: { to: string; docs: Doc[]; spec: any; review: boolean; brand?: string }) {
  const b = brandFor(o.brand);
  const T = o.spec?.totals || {};
  const problems = o.spec._validation?.length
    ? `<p style="color:#8a3b2a"><b>Validation flagged ${o.spec._validation.length}:</b><br>${o.spec._validation.join('<br>')}</p>` : '';

  await resend().emails.send({
    from: FROM, to: o.to,
    // The proposal number is in the subject on purpose: it is how a reply
    // carrying the marked-up page finds its way back to the right job.
    subject: o.review
      ? `[REVIEW] ${o.spec.proposal_no} — ready for Dan`
      : `${o.spec.proposal_no} — ${o.spec.project_name || 'your estimate'}`,
    html: wrap(`
      ${o.review ? '<p style="color:#8a3b2a"><b>Review copy.</b> Nothing has gone to Dan.</p>' : ''}
      <p><b>${T.total === null ? 'Priced except for what is still open.' : 'Priced.'}</b>
         Attached, and in ${b.driveFolder}.</p>
      <p>Mark it up and reply with it attached — I read the marks and log them.</p>
      ${problems}`, o.brand),
    attachments: o.docs.map(d => ({ filename: d.filename, content: d.pdf.toString('base64') })),
  });
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
