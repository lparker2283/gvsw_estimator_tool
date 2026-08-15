/**
 * Resend inbound webhook. Dan emails a voice memo; this is where it lands.
 * Flow: verify -> pull audio -> transcribe -> extract -> store -> email him one link.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Webhook } from 'svix';
import { transcribe } from '@/lib/transcribe';
import { extract } from '@/lib/extract';
import { db } from '@/lib/db';
import { sendQuestionsEmail } from '@/lib/mail';
import { redact } from '@/lib/secrets';

export const maxDuration = 120;

const AUDIO = /\.(m4a|mp3|mp4|wav|aac|ogg|webm|amr|caf)$/i;

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
async function loadAudio(emailId: string, att: any): Promise<Blob> {
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

  const audio = attachments.find(a => AUDIO.test(a.filename || ''));
  if (!audio) {
    /**
     * A skip used to return 200 and say nothing, which from the sender's side is
     * indistinguishable from the mail never arriving. Log enough to name the
     * cause: the envelope's shape, and what the attachments actually were.
     * Keys and filenames only — the bodies are client data and stay out of logs.
     */
    console.error('[inbound] no audio attachment — nothing to transcribe.', {
      envelopeKeys: Object.keys(envelope ?? {}),
      unwrapped: payload !== envelope,
      payloadKeys: Object.keys(payload ?? {}),
      attachmentCount: attachments.length,
      filenames: attachments.map(a => a?.filename ?? '(no filename)'),
      accepts: String(AUDIO),
    });
    return NextResponse.json({ ok: true, skipped: 'no audio attachment' });
  }

  /**
   * Each step names itself before it runs. An unhandled throw here returns a
   * bare 500, and from the outside every stage's 500 looks the same — fetching
   * the audio, a missing GROQ_API_KEY, the model call, the database, the reply.
   * One variable turns that into a log line that says which.
   */
  let stage = 'fetch audio';
  try {
    const clip = await loadAudio(payload.email_id || payload.id || '', audio);

    stage = 'transcribe';
    const transcript = await transcribe(clip, audio.filename);

    stage = 'extract';
    const extraction = await extract(transcript);

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
    console.error(`[inbound] failed during: ${stage}`, {
      message: redact(describe(err)),
      from,
      filename: audio.filename,
    });
    /**
     * The message goes in the body, not only the log. Resend's dashboard shows
     * the response verbatim, and its delivery history is reachable in a way the
     * platform logs are not always. `stage` alone named the step but never the
     * reason, which cost a full deploy-and-resend cycle to learn.
     *
     * Safe to expose: the route only reaches here after a verified signature,
     * so nothing but Resend can provoke it, and these strings carry status
     * codes and field names — never the API key.
     */
    // 500 so Svix retries, and so this is visibly distinct from the silent skip.
    return NextResponse.json(
      { error: 'processing failed', stage, detail: redact(describe(err)).slice(0, 400) },
      { status: 500 },
    );
  }
}
