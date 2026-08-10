import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const job = await db.getJobByToken(params.token);
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });
  // Only what the browser needs. No pricing, no internals.
  return NextResponse.json({ questions: job.questions, status: job.status });
}
