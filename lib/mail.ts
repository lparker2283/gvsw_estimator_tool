import { Resend } from 'resend';
import type { Doc } from './docs';

// Built on first use: the SDK throws without a key, and Next imports this
// module while collecting page data during the build, where no key exists.
let _resend: Resend | null = null;
function resend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM = process.env.MAIL_FROM!;

const wrap = (body: string) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
  font-size:16px;line-height:1.6;color:#33322e;max-width:520px">
  <div style="font-size:11px;letter-spacing:.2em;color:#3f4a3c;font-weight:700;margin-bottom:18px">
    GENESEE VALLEY STONE WORKS</div>${body}</div>`;

export async function sendQuestionsEmail(o: { to: string; count: number; link: string; transcript: string }) {
  const noun = o.count === 1 ? 'question' : 'questions';
  await resend().emails.send({
    from: FROM, to: o.to,
    subject: `Got your memo — ${o.count} ${noun}, about a minute`,
    html: wrap(`
      <p>Got it, and transcribed it.</p>
      <p><b>${o.count} ${noun}</b> before I can price it — the ones where guessing would actually cost you money. Should take about a minute.</p>
      <p style="margin:26px 0">
        <a href="${o.link}" style="display:inline-block;background:#3f4a3c;color:#fff;text-decoration:none;
          padding:15px 30px;border-radius:8px;font-weight:600;font-size:17px">Answer the ${noun}</a></p>
      <p style="font-size:14px;color:#807b72">Every one has a "don't know — measure on site" option. That's a real answer, not a cop-out; the documents handle it.</p>
      <details style="margin-top:24px">
        <summary style="font-size:13px;color:#807b72;cursor:pointer">What I heard</summary>
        <p style="font-size:13px;color:#807b72;font-style:italic;margin-top:10px">${o.transcript}</p>
      </details>`),
  });
}

export async function deliver(o: { to: string; docs: Doc[]; spec: any; review: boolean }) {
  const list = o.docs.map(d => `<li><b>${d.name}</b> <span style="color:#807b72">— ${d.audience === 'dan' ? 'yours' : 'client-facing'}</span></li>`).join('');
  const problems = o.spec._validation?.length
    ? `<p style="color:#8a3b2a"><b>Validation flagged ${o.spec._validation.length}:</b><br>${o.spec._validation.join('<br>')}</p>` : '';

  await resend().emails.send({
    from: FROM, to: o.to,
    subject: o.review
      ? `[REVIEW] ${o.spec.proposal_no} — ready for Dan`
      : `${o.spec.proposal_no} — your estimate`,
    html: wrap(`
      ${o.review ? '<p style="color:#8a3b2a"><b>Review copy.</b> Nothing has gone to Dan.</p>' : ''}
      <p>Four documents attached, and in the GVSW Estimates folder in Drive — so they'll show up on your reMarkable.</p>
      <ul>${list}</ul>
      <p><b>Start with the field brief.</b> Mark it up and send it back — that's how the tool learns what it got wrong.</p>
      ${problems}
      <p style="font-size:14px;color:#807b72">Nothing here is committed. The tool proposes; you commit.</p>`),
    attachments: o.docs.map(d => ({ filename: d.filename, content: d.pdf.toString('base64') })),
  });
}
