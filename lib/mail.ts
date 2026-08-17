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
  const list = o.docs.map(d => `<li><b>${d.name}</b> <span style="color:${b.muted}">— ${d.audience === 'dan' ? 'yours' : 'client-facing'}</span></li>`).join('');
  const problems = o.spec._validation?.length
    ? `<p style="color:#8a3b2a"><b>Validation flagged ${o.spec._validation.length}:</b><br>${o.spec._validation.join('<br>')}</p>` : '';

  await resend().emails.send({
    from: FROM, to: o.to,
    subject: o.review
      ? `[REVIEW] ${o.spec.proposal_no} — ready for Dan`
      : `${o.spec.proposal_no} — your estimate`,
    html: wrap(`
      ${o.review ? '<p style="color:#8a3b2a"><b>Review copy.</b> Nothing has gone to Dan.</p>' : ''}
      <p>Four documents attached, and in the ${b.driveFolder} folder in Drive.</p>
      <ul>${list}</ul>
      <p><b>Start with the field brief.</b> Mark it up and send it back.</p>
      ${problems}
      <p style="font-size:14px;color:${b.muted}">Nothing here is committed.</p>`, o.brand),
    attachments: o.docs.map(d => ({ filename: d.filename, content: d.pdf.toString('base64') })),
  });
}
