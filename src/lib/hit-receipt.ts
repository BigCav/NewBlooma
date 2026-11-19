/**
 * The EFTPOS receipt Windcave's terminal sends back. The terminal has no printer, so the POS shows and prints it, and it must be shown exactly as sent.
 * `signature`: the copy to sign, sent while the terminal waits for YES / NO. `final`: the receipt with the result (customer copy, or the voided one after NO).
 * `merchant`: the merchant copy, asked for afterwards with a Receipt request.
 */
export type HitReceipt = { stage: 'signature' | 'final' | 'merchant'; width: number; text: string };

/** XML text as it was written: the five escaped characters turned back. Nothing else about the content is touched. */
export const decodeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/**
 * The receipt as lines to print. Windcave sends one string of fixed-width lines (`width` characters each, no line breaks, "RcptW" in the reply),
 * so it is cut every `width` characters; if the text does carry line breaks they are used as they are. Only trailing spaces are dropped.
 */
export function receiptLines(text: string, width: number): string[] {
  const t = text.replace(/\r\n?/g, '\n');
  const raw = t.includes('\n') ? t.split('\n') : width > 0 ? (t.match(new RegExp(`[\\s\\S]{1,${Math.floor(width)}}`, 'g')) ?? []) : [t];
  return raw.map((l) => l.replace(/\s+$/, ''));
}

/** The receipts of a payment with this one put in its place (one per stage). */
export function withReceipt(list: unknown, r: HitReceipt): HitReceipt[] {
  const have = (Array.isArray(list) ? list : []) as HitReceipt[];
  return [...have.filter((x) => x.stage !== r.stage), r];
}

/** The receipt to show for a payment: the final one once there is one, otherwise the one to sign. */
export function latestReceipt(list: unknown): HitReceipt | undefined {
  const have = (Array.isArray(list) ? list : []) as HitReceipt[];
  return have.find((x) => x.stage === 'final') ?? have.find((x) => x.stage === 'signature');
}
