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

export const maxDuration = 120;

const AUDIO = /\.(m4a|mp3|mp4|wav|aac|ogg|webm|amr|caf)$/i;

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

  const payload = JSON.parse(raw);
  const from: string = payload.from?.address || payload.from || '';
  const attachments: any[] = payload.attachments || [];

  const audio = attachments.find(a => AUDIO.test(a.filename || ''));
  if (!audio) {
    return NextResponse.json({ ok: true, skipped: 'no audio attachment' });
  }

  const bytes = audio.content_url
    ? await (await fetch(audio.content_url)).arrayBuffer()
    : Buffer.from(audio.content, 'base64');

  const transcript = await transcribe(new Blob([bytes]), audio.filename);
  const extraction = await extract(transcript);

  const token = crypto
    .createHmac('sha256', process.env.LINK_SIGNING_SECRET!)
    .update(crypto.randomUUID())
    .digest('hex')
    .slice(0, 24);

  const job = await db.createJob({
    from_email: from,
    transcript,
    category: extraction.category,
    extraction,
    questions: extraction.questions,
    token,
    status: 'awaiting_answers',
  });

  await sendQuestionsEmail({
    to: from || process.env.DAN_EMAIL!,
    count: extraction.questions.length,
    link: `${process.env.APP_URL}/q/${token}`,
    transcript,
  });

  return NextResponse.json({ ok: true, job: job.id, questions: extraction.questions.length });
}
