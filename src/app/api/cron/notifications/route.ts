import { NextResponse, type NextRequest } from 'next/server';
import { cronAuthorised } from '@/lib/cron-auth';
import { processOutbox } from '@/lib/notify';

export const maxDuration = 60;
export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  return NextResponse.json(await processOutbox());
}
