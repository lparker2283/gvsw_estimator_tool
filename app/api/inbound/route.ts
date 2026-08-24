/**
 * Resend inbound webhook. One address, two jobs, told apart by what is attached.
 *
 *   audio  -> a new job:    verify -> pull audio -> transcribe -> extract -> email one link
 *   PDF    -> a correction: verify -> pull PDF   -> read the marks -> ledger -> confirm
 *
 * Routing on the attachment rather than on a second address is deliberate. Dan
 * replies to the email the brief arrived in; there is nothing to remember, no
 * address to get right, and it works whether he marked it up on the reMarkable
 * or on paper with a pencil and photographed it into a PDF.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Webhook } from 'svix';
import { transcribe } from '@/lib/transcribe';
import { extract } from '@/lib/extract';
import { readMarkup, digest } from '@/lib/corrections';
import { db } from '@/lib/db';
import { sendQuestionsEmail, sendCorrectionsEmail } from '@/lib/mail';
import { redact } from '@/lib/secrets';

export const maxDuration = 120;

const AUDIO = /\.(m4a|mp3|mp4|wav|aac|ogg|webm|amr|caf)$/i;
const PDF = /\.pdf$/i;

/** e.g. GVSW-2026-0147, wherever it appears — a filename, a subject, a reply prefix. */
const PROPOSAL_NO = /\b[A-Z]{2,6}-\d{4}-\d{3,5}\b/;

/**
 * How many times a memo may fail before this endpoint stops asking for another
 * delivery. Svix spaces its retries over hours, so three attempts is roughly
 * half an hour of patience — enough to outlast a provider having a bad minute,
 * short of the streak that gets a webhook switched off.
 */
const MAX_ATTEMPTS = Number(process.env.INBOUND_MAX_ATTEMPTS || 3);

/**
 * Get the actual audio.
 *
 * The inbound webhook describes an attachment without carrying it: filename,
 * content type, size, an id — and no bytes and no URL. Reaching for `content`
 * there yields undefined, which is what killed the first memo that got this
 * far. The content sits behind a second, authenticated call that hands back a
 * short-lived signed `download_url`.
 *
 * The two inline branches come first because they cost nothing to keep and mean
 * a payload that does carry its own bytes still works.
 */
async function loadAttachment(emailId: string, att: any): Promise<Blob> {
  if (att.content_url) {
    const res = await fetch(att.content_url);
    if (!res.ok) throw new Error(`content_url fetch failed: ${res.status}`);
    return new Blob([await res.arrayBuffer()], { type: att.content_type || '' });
  }
  if (att.content) {
    return new Blob([Buffer.from(att.content, 'base64')], { type: att.content_type || '' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is required to download an inbound attachment');
  if (!emailId || !att.id) {
    throw new Error(`cannot locate attachment (email_id=${emailId || 'missing'}, id=${att.id || 'missing'})`);
  }

  /**
   * Two candidate routes. The SDK puts received mail under `/emails/receiving`
   * and sent mail under `/emails`, but which one an account's API actually
   * serves is not something that can be confirmed from here, and each guess
   * costs a deploy and a memo. So try both and report what each said.
   */
  const routes = [
    `https://api.resend.com/emails/receiving/${emailId}/attachments/${att.id}`,
    `https://api.resend.com/emails/${emailId}/attachments/${att.id}`,
  ];

  const tried: string[] = [];
  let meta: any = null;

  for (const url of routes) {
    const lookup = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (lookup.ok) {
      meta = await lookup.json();
      break;
    }
    const detail = (await lookup.text().catch(() => '')).slice(0, 200);
    tried.push(`${lookup.status} ${url.replace('https://api.resend.com', '')}${detail ? ` — ${detail}` : ''}`);
    // Only a missing route is worth a second attempt. A 401 means the key is
    // wrong and the other route will say the same thing.
    if (lookup.status !== 404) break;
  }

  if (!meta) throw new Error(`attachment lookup failed: ${tried.join(' | ')}`);
  if (!meta.download_url) {
    throw new Error(`attachment lookup returned no download_url (keys: ${Object.keys(meta).join(',')})`);
  }

  // Signed and short-lived, so it is fetched now rather than stored.
  const file = await fetch(meta.download_url);
  if (!file.ok) throw new Error(`attachment download failed: ${file.status}`);

  return new Blob([await file.arrayBuffer()], { type: att.content_type || 'application/octet-stream' });
}

/**
 * Unwrap an error down its `cause` chain.
 *
 * SDKs routinely swallow the real reason. Anthropic's APIConnectionError, for
 * one, defaults its message to a bare "Connection error." and files the actual
 * failure under `cause` — which said nothing at all about a malformed key.
 */
function describe(err: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let cur: any = err;
  while (cur && parts.length < 4 && !seen.has(cur)) {
    seen.add(cur);
    const message = typeof cur.message === 'string' ? cur.message : String(cur);
    if (message && !parts.includes(message)) parts.push(message);
    cur = cur.cause;
  }
  return parts.join(' <- ');
}

/**
 * Would delivering this memo again plausibly go any better?
 *
 * Only for failures a later attempt could survive — a rate limit, a provider
 * having a bad minute, a socket that dropped. A malformed key or a rejected
 * request fails identically every time, and retrying it is what spends the
 * endpoint's health: Resend disabled this webhook after five days of 500s that
 * no retry could ever have fixed.
 *
 * The default is false, deliberately. Declining to retry costs one memo, which
 * is written down and recoverable; retrying something unfixable costs every
 * memo that comes after it.
 */
function isRetryable(err: unknown): boolean {
  const chain: any[] = [];
  const seen = new Set<unknown>();
  let cur: any = err;
  while (cur && chain.length < 4 && !seen.has(cur)) {
    seen.add(cur);
    chain.push(cur);
    cur = cur.cause;
  }

  const text = chain.map(e => (typeof e?.message === 'string' ? e.message : String(e))).join(' ');

  // A value the runtime refused is malformed, not unlucky — and this shape
  // arrives wrapped in a connection error, which would otherwise read as
  // transient. It is the exact failure that started the streak.
  if (/invalid header|is not a legal|malformed|invalid.*value/i.test(text)) return false;

  const status = chain.map(e => e?.status ?? e?.statusCode).find((s: any) => typeof s === 'number');
  if (typeof status === 'number') return status === 408 || status === 429 || status >= 500;

  // No status at all means the request never reached the far end.
  return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up|network|timed ?out|aborted/i
    .test(text);
}

/**
 * A brief came back with marks on it.
 *
 * Finding the job is done by proposal number rather than by sender or by
 * thread: the number is printed on the page, sits in the filename the tool
 * chose, and survives in the subject line through every "Re:" a mail client
 * adds. A reply from a different address — his phone, his wife's laptop, a
 * scan-to-email box at the print shop — still lands on the right job.
 *
 * When no number can be found the delivery is NOT retried. A PDF with no
 * proposal number on it will have no proposal number on it the second time
 * either, and the row that gets written is enough to file it by hand.
 */
async function handleCorrection(
  o: { payload: any; marked: any; subject: string; from: string; eventId: string },
): Promise<NextResponse> {
  const { payload, marked, subject, from, eventId } = o;

  if (eventId) {
    const already = await db.correctionsForEvent(eventId);
    if (already) {
      console.warn('[inbound] duplicate correction delivery ignored.', { eventId });
      return NextResponse.json({ ok: true, deduped: true, mode: 'correction' });
    }
  }

  const no = (marked.filename?.match(PROPOSAL_NO) || subject.match(PROPOSAL_NO) || [])[0];

  let stage = 'identify job';
  try {
    if (!no) throw new Error(`no proposal number in filename "${marked.filename}" or subject "${subject.slice(0, 80)}"`);

    const job = await db.getJobByProposalNo(no);
    if (!job) throw new Error(`no job found for ${no}`);

    stage = 'fetch marked-up pdf';
    const blob = await loadAttachment(payload.email_id || payload.id || '', marked);
    const pdf = Buffer.from(await blob.arrayBuffer());

    stage = 'read markup';
    const reading = await readMarkup(pdf, job.job_spec);

    stage = 'write ledger';
    await db.logCorrections((reading.marks || []).map(m => ({
      job_id: job.id,
      event_id: eventId || null,
      source: 'annotation',
      kind: ['quantity', 'rate', 'line'].includes(m.kind) ? m.kind : 'other',
      line_ref: m.line_ref || null,
      tool_value: m.tool_value || null,
      dan_value: m.dan_value || null,
      note: m.note || null,
      confidence: m.confidence || null,
    })));

    /**
     * An approved page has nothing to file, and an unreadable one must not be
     * recorded as approval. Both still move the job on — the difference is
     * only in what the confirmation says.
     */
    await db.updateJob(job.id, { status: reading.verdict === 'unreadable' ? 'delivered' : 'corrected' });

    stage = 'confirm';
    await sendCorrectionsEmail({
      to: from || process.env.DAN_EMAIL!,
      proposalNo: no,
      reading,
    });

    return NextResponse.json({ ok: true, mode: 'correction', job: job.id, marks: reading.marks?.length ?? 0 });
  } catch (err) {
    const detail = redact(describe(err));
    const retryable = stage !== 'identify job' && isRetryable(err);

    console.error(`[inbound] correction failed during: ${stage}`, { message: detail, from, filename: marked.filename, retryable });

    let attempts = 1;
    try {
      attempts = await db.recordInboundFailure({
        event_id: eventId || null,
        from_email: from || null,
        filename: marked.filename || null,
        email_id: payload.email_id || payload.id || null,
        attachment_id: marked.id || null,
        stage: `correction: ${stage}`,
        detail: detail.slice(0, 2000),
        retryable,
      });
    } catch (e) {
      console.error('[inbound] could not record the correction failure.', { message: redact(describe(e)) });
      return NextResponse.json({ error: 'correction failed', stage, detail: detail.slice(0, 400), recorded: false }, { status: 500 });
    }

    const again = retryable && attempts < MAX_ATTEMPTS;
    return NextResponse.json(
      { error: 'correction failed', stage, detail: detail.slice(0, 400), retryable, attempts, willRetry: again },
      { status: again ? 500 : 200 },
    );
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  /**
   * Resend signs webhooks with Svix. The signature covers
   * `${svix-id}.${svix-timestamp}.${body}` — NOT the body alone — the secret is
   * base64 after its `whsec_` prefix is stripped, and the digest is base64, not hex.
   * A hand-rolled HMAC over the raw body gets all three of those wrong and rejects
   * every legitimate delivery. Use the official verifier; it also enforces the
   * timestamp tolerance that stops a captured request being replayed.
   */
  const secret = process.env.RESEND_INBOUND_SECRET;
  if (!secret) {
    // Fail CLOSED. An unauthenticated inbound webhook is an open door: anyone who
    // finds the URL can post a fake memo and burn transcription and model spend.
    console.error('[inbound] RESEND_INBOUND_SECRET is not set — refusing the request.');
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });
  }

  try {
    new Webhook(secret).verify(raw, {
      'svix-id': req.headers.get('svix-id') || '',
      'svix-timestamp': req.headers.get('svix-timestamp') || '',
      'svix-signature': req.headers.get('svix-signature') || '',
    });
  } catch (err) {
    // Log which headers actually arrived. If Resend ever renames them, this line is
    // the difference between a five-minute fix and an afternoon.
    console.error('[inbound] signature verification failed.', {
      message: (err as Error).message,
      headers: [...req.headers.keys()].filter(h => /svix|resend|signature/i.test(h)),
    });
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  /**
   * Svix reuses its message id across every retry of the same delivery, which
   * makes it the natural idempotency key. Checked before any work: a retry that
   * arrives after the job was written costs one indexed lookup instead of a
   * second transcription, a second extraction, a second row, and a second email
   * to Dan carrying a different link to the same memo.
   */
  const eventId = req.headers.get('svix-id') || '';
  if (eventId) {
    const seen = await db.getJobByEventId(eventId);
    if (seen) {
      console.warn('[inbound] duplicate delivery ignored.', { eventId, job: seen.id });
      return NextResponse.json({ ok: true, deduped: true, job: seen.id });
    }
  }

  const envelope = JSON.parse(raw);

  /**
   * Resend's other webhooks wrap their fields in `data`. Whether inbound does
   * too is not something we can confirm from here, so read either shape: `data`
   * when it is an object, the top level otherwise. Guessing wrong the first way
   * cost a silent skip and a live memo, which is more than this line costs.
   */
  const payload = envelope?.data && typeof envelope.data === 'object' ? envelope.data : envelope;

  const from: string = payload.from?.address || payload.from || '';
  const attachments: any[] = payload.attachments || [];

  const subject: string = payload.subject || '';

  /**
   * Audio wins over PDF. A reply that quotes the original brief can carry both,
   * and a mason who attaches a fresh memo to an old thread means the memo.
   */
  const audio = attachments.find(a => AUDIO.test(a.filename || ''));
  const marked = audio ? null : attachments.find(a => PDF.test(a.filename || ''));

  if (!audio && !marked) {
    /**
     * A skip used to return 200 and say nothing, which from the sender's side is
     * indistinguishable from the mail never arriving. Log enough to name the
     * cause: the envelope's shape, and what the attachments actually were.
     * Keys and filenames only — the bodies are client data and stay out of logs.
     */
    console.error('[inbound] no audio and no PDF — nothing to do.', {
      envelopeKeys: Object.keys(envelope ?? {}),
      unwrapped: payload !== envelope,
      payloadKeys: Object.keys(payload ?? {}),
      attachmentCount: attachments.length,
      filenames: attachments.map(a => a?.filename ?? '(no filename)'),
      accepts: `${AUDIO} | ${PDF}`,
    });
    return NextResponse.json({ ok: true, skipped: 'no audio or PDF attachment' });
  }

  if (marked) return handleCorrection({ payload, marked, subject, from, eventId });

  /**
   * Each step names itself before it runs. An unhandled throw here returns a
   * bare 500, and from the outside every stage's 500 looks the same — fetching
   * the audio, a missing GROQ_API_KEY, the model call, the database, the reply.
   * One variable turns that into a log line that says which.
   */
  let stage = 'fetch audio';
  try {
    const clip = await loadAttachment(payload.email_id || payload.id || '', audio);

    stage = 'transcribe';
    const transcript = await transcribe(clip, audio.filename);

    stage = 'extract';
    const extraction = await extract(transcript, digest(await db.recentCorrections().catch(() => [])));

    const token = crypto
      .createHmac('sha256', process.env.LINK_SIGNING_SECRET!)
      .update(crypto.randomUUID())
      .digest('hex')
      .slice(0, 24);

    stage = 'create job';
    let job;
    try {
      job = await db.createJob({
        from_email: from,
        transcript,
        category: extraction.category,
        extraction,
        questions: extraction.questions,
        token,
        event_id: eventId || null,
        status: 'awaiting_answers',
      });
    } catch (e: any) {
      /**
       * 23505 is unique_violation. The check above catches a retry that arrives
       * after the first one finished; this catches the narrower case of two
       * deliveries in flight together, where both passed the check before either
       * inserted. The row that landed first is the real one — stop here rather
       * than send Dan a second link.
       */
      if (e?.code === '23505' && eventId) {
        const winner = await db.getJobByEventId(eventId);
        console.warn('[inbound] concurrent duplicate lost the race; keeping the first job.', {
          eventId,
          job: winner?.id,
        });
        return NextResponse.json({ ok: true, deduped: true, job: winner?.id });
      }
      throw e;
    }

    // The job is saved by this point. If the reply fails the work is not lost —
    // the row is there, and the link can be resent by hand.
    stage = 'send questions email';
    await sendQuestionsEmail({
      to: from || process.env.DAN_EMAIL!,
      count: extraction.questions.length,
      link: `${process.env.APP_URL}/q/${token}`,
      transcript,
    });

    return NextResponse.json({ ok: true, job: job.id, questions: extraction.questions.length });
  } catch (err) {
    const detail = redact(describe(err));
    const retryable = isRetryable(err);

    console.error(`[inbound] failed during: ${stage}`, {
      message: detail,
      from,
      filename: audio.filename,
      retryable,
    });

    /**
     * Write the failure down before deciding what to tell Resend. The row is
     * what makes it safe to stop retrying: the memo is recoverable from
     * email_id and attachment_id, so giving up loses a delivery, not the work.
     */
    let attempts = 1;
    try {
      attempts = await db.recordInboundFailure({
        event_id: eventId || null,
        from_email: from || null,
        filename: audio.filename || null,
        email_id: payload.email_id || payload.id || null,
        attachment_id: audio.id || null,
        stage,
        detail: detail.slice(0, 2000),
        retryable,
      });
    } catch (e) {
      // Nothing was recorded, so nothing makes giving up safe. Ask for the
      // retry: a memo delivered twice is recoverable, one dropped silently is not.
      console.error('[inbound] could not record the failure.', { message: redact(describe(e)) });
      return NextResponse.json(
        { error: 'processing failed', stage, detail: detail.slice(0, 400), recorded: false },
        { status: 500 },
      );
    }

    const again = retryable && attempts < MAX_ATTEMPTS;

    /**
     * The message goes in the body, not only the log. Resend's dashboard shows
     * the response verbatim, and its delivery history is reachable in a way the
     * platform logs are not always. `stage` alone named the step but never the
     * reason, which cost a full deploy-and-resend cycle to learn.
     *
     * Safe to expose: the route only reaches here after a verified signature,
     * so nothing but Resend can provoke it, and these strings carry status
     * codes and field names — never the API key.
     *
     * The status is the part that matters to the endpoint's survival. 500 asks
     * Svix to try again and is worth spending only where another attempt could
     * succeed; everything else answers 200 — the delivery is accounted for, and
     * a webhook that keeps failing is a webhook Resend eventually turns off.
     */
    return NextResponse.json(
      { error: 'processing failed', stage, detail: detail.slice(0, 400), retryable, attempts, willRetry: again },
      { status: again ? 500 : 200 },
    );
  }
}
