/**
 * Resend inbound webhook. Dan emails a voice memo; this is where it lands.
 * Flow: verify -> pull audio -> transcribe -> extract -> store -> email him one link.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { transcribe } from '@/lib/transcribe';
import { extract } from '@/lib/extract';
import { db } from '@/lib/db';
import { sendQuestionsEmail } from '@/lib/mail';

export const maxDuration = 120;

const AUDIO = /\.(m4a|mp3|mp4|wav|aac|ogg|webm|amr|caf)$/i;

export async function POST(req: NextRequest) {
  const raw = await req.text();

  const secret = process.env.RESEND_INBOUND_SECRET;
  if (secret) {
    const sig = req.headers.get('svix-signature') || req.headers.get('resend-signature') || '';
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (!sig.includes(expected)) return NextResponse.json({ error: 'bad signature' }, { status: 401 });
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
