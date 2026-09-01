import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_BRAND } from '@/lib/brand';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const job = await db.getJobByToken(token);
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });
  // Only what the browser needs. No pricing, no internals.
  // The brand falls back rather than being required, so the page can be
  // themed per tenant before any job row carries a `brand` column.
  //
  // `intake` prefills the first screen: what he already typed if he has been
  // here before, otherwise what the extractor heard. Either way he confirms it.
  const heard = job.extraction?.job || {};
  return NextResponse.json({
    questions: job.questions,
    status: job.status,
    brand: job.brand ?? DEFAULT_BRAND,
    intake: { client: job.client ?? heard.client ?? null, area: job.area ?? heard.area ?? null },
  });
}
