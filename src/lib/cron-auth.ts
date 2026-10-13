import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export function cronAuthorised(req: NextRequest) {
  const secret = process.env.CRON_SECRET; if (!secret) return false;
  const got = req.headers.get('authorization') ?? '';
  const want = `Bearer ${secret}`;
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
