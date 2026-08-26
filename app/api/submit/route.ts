/**
 * Answers come back from /q/<token>. Price, generate, deliver.
 *
 * Every step names itself before it runs, and a failure is written to the job
 * row rather than thrown into the void. The inbound route learned this lesson
 * already; this route had not, and the cost was exact: a real submit died four
 * times in a row, and all it left behind was a job stuck at `generating` and a
 * proposal counter that had advanced four times. Nothing said which step, and
 * nothing said why.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { price } from '@/lib/price';
import { buildDocuments } from '@/lib/docs';
import { deliver } from '@/lib/mail';
import { uploadToDrive } from '@/lib/drive';
import { digest } from '@/lib/corrections';
import { redact } from '@/lib/secrets';

export const maxDuration = 300;

/** Unwrap an error down its `cause` chain — SDKs routinely swallow the real reason. */
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
  const { token, answers } = await req.json();
  const job = await db.getJobByToken(token);
  if (!job) return NextResponse.json({ error: 'unknown job' }, { status: 404 });

  await db.updateJob(job.id, { answers, status: 'generating', failure: null });

  let stage = 'price';
  try {
    // Everything Dan has already corrected by hand, priced in before the model
    // reaches for the card. A ledger nothing reads is a diary.
    const prior = digest(await db.recentCorrections().catch(() => []));

    const spec = await price(job.extraction, answers, prior);

    /**
     * The number is taken only once pricing has actually succeeded. It used to
     * be taken immediately afterwards and then lost when the render died, which
     * is why the counter reads 5 with nothing delivered — four burned numbers,
     * each one a submit that got this far and no further.
     */
    stage = 'assign proposal number';
    spec.proposal_no = await db.nextProposalNo();
    // Server clock, not the model's idea of today. It has been wrong about the date.
    spec.date_issued = new Date().toISOString().slice(0, 10);

    stage = 'render documents';
    const docs = await buildDocuments(spec, job.extraction, job.transcript);

    // Drive first — this is what surfaces on the reMarkable. A failure here is
    // survivable: the documents still go by mail, which is the path that matters.
    stage = 'upload to drive';
    const driveLinks = await uploadToDrive(docs, spec.proposal_no).catch(e => {
      console.error('[submit] drive upload failed, continuing to email', e);
      return [] as string[];
    });

    stage = 'send email';
    const humanInLoop = process.env.HUMAN_IN_THE_LOOP === 'true';
    await deliver({
      to: humanInLoop ? process.env.CC_EMAIL! : (job.from_email || process.env.DAN_EMAIL!),
      docs,
      spec,
      // "Worth knowing" is in the email now, and it lives on the extraction.
      extraction: job.extraction,
      review: humanInLoop,
    });

    await db.updateJob(job.id, {
      job_spec: spec, status: 'delivered', delivered_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, validation: spec._validation, drive: driveLinks });
  } catch (err) {
    const detail = redact(describe(err));
    console.error(`[submit] failed during: ${stage}`, { job: job.id, message: detail });

    /**
     * Write it down before answering. `generating` with no explanation is the
     * state this route left behind four times, and it is indistinguishable from
     * a request that never arrived.
     */
    await db.updateJob(job.id, {
      status: 'failed',
      failure: `${stage}: ${detail}`.slice(0, 2000),
    }).catch(e => console.error('[submit] could not record the failure', e));

    // The reason goes in the body: the question page renders it, so whoever is
    // standing there finds out what happened instead of watching a dead screen.
    return NextResponse.json({ error: `${stage} failed — ${detail.slice(0, 300)}`, stage }, { status: 500 });
  }
}
