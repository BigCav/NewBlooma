import { NextResponse, type NextRequest } from 'next/server';
import { requireCtx } from '@/lib/session';
import { cancelTerminal, pressTerminalButton } from '@/lib/windcave';

/** Cancel or answer a button on the card terminal. A plain request rather than a server action: server actions run one at a time, so Cancel would wait behind the status checks Windcave holds open. */
export async function POST(req: NextRequest) {
  await requireCtx();
  const b = await req.json().catch(() => ({})) as { op?: string; txn?: string; name?: string; label?: string };
  if (!b.txn || !/^TM[0-9a-f]{18}$/.test(b.txn)) return NextResponse.json({ error: 'bad txn' }, { status: 400 });
  if (b.op === 'cancel') await cancelTerminal(b.txn);
  else if (b.op === 'press') await pressTerminalButton(b.txn, String(b.name ?? ''), String(b.label ?? ''));
  else return NextResponse.json({ error: 'bad op' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
