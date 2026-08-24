/**
 * Answers come back from /q/<token>. Price, generate, deliver.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { price } from '@/lib/price';
import { buildDocuments } from '@/lib/docs';
import { deliver } from '@/lib/mail';
import { uploadToDrive } from '@/lib/drive';
import { digest } from '@/lib/corrections';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { token, answers } = await req.json();
  const job = await db.getJobByToken(token);
  if (!job) return NextResponse.json({ error: 'unknown job' }, { status: 404 });

  await db.updateJob(job.id, { answers, status: 'generating' });

  // Everything Dan has already corrected by hand, priced in before the model
  // reaches for the card. A ledger nothing reads is a diary.
  const prior = digest(await db.recentCorrections().catch(() => []));

  const spec = await price(job.extraction, answers, prior);
  const proposalNo = await db.nextProposalNo();
  spec.proposal_no = proposalNo;
  // Server clock, not the model's idea of today. It has been wrong about the date.
  spec.date_issued = new Date().toISOString().slice(0, 10);

  const docs = await buildDocuments(spec, job.extraction, job.transcript);

  // Drive first — this is what surfaces on the reMarkable.
  const driveLinks = await uploadToDrive(docs, proposalNo).catch(e => {
    console.error('drive upload failed, continuing to email', e);
    return [] as string[];
  });

  const humanInLoop = process.env.HUMAN_IN_THE_LOOP === 'true';
  await deliver({
    to: humanInLoop ? process.env.CC_EMAIL! : (job.from_email || process.env.DAN_EMAIL!),
    docs,
    spec,
    review: humanInLoop,
  });

  await db.updateJob(job.id, { job_spec: spec, status: 'delivered', delivered_at: new Date().toISOString() });
  return NextResponse.json({ ok: true, validation: spec._validation, drive: driveLinks });
}
