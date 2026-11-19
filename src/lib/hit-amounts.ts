/**
 * Splits the amount a terminal reports as approved into the ticket, the tip and the surcharge Windcave's host added.
 * Returns what to record apart from the ticket, or null when the amounts do not add up to the sale (the payment is then flagged for review).
 * Windcave may or may not include the tip and the surcharge in the approved amount, so every combination that adds up to the ticket is accepted.
 * `surcharge` is the terminal's own surcharge field when it sent one; when it did not, anything approved above ticket plus tip is taken to be the surcharge.
 */
export function splitAmounts(paid: number, tip: number, surcharge: number | undefined, ticket: number): { tip: number; surcharge: number } | null {
  if (!Number.isFinite(paid) || !Number.isFinite(tip) || tip < 0 || paid <= 0) return null;
  const sur = surcharge !== undefined && Number.isFinite(surcharge) && surcharge >= 0 ? surcharge : undefined;
  for (const t of [0, tip]) for (const s of sur === undefined ? [0] : [0, sur]) {
    if (paid - t - s === ticket) return { tip, surcharge: sur ?? 0 };
  }
  if (sur === undefined && paid - tip > ticket) return { tip, surcharge: paid - tip - ticket };
  return null;
}
