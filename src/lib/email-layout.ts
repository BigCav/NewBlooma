// One look for every email the site sends: grey page, white card, brand name on top, optional heading, body, buttons, small footer.
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** A paragraph of body text. Newlines inside it become line breaks. */
export const mailP = (text: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#0E1116">${esc(text).replace(/\n/g, '<br>')}</p>`;

/** A small grey note under the body. */
export const mailNote = (text: string) => `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#5E6673">${esc(text).replace(/\n/g, '<br>')}</p>`;

/** The accent every email button uses. A saturated colour is kept as it is by Gmail and Outlook dark mode; a near-black button turned into a dark patch on a dark card. */
const BTN = '#5B3DF5';

/** A pill button in the accent colour. It is a table cell with a background colour, not just a styled link, so mail apps keep the colour in dark mode.
 *  (The tone argument is kept so older callers still compile; both look the same.) */
export const mailButton = (label: string, url: string, _tone: 'primary' | 'dark' = 'primary') =>
  `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0 0;border-collapse:separate"><tr><td bgcolor="${BTN}" style="background:${BTN};border:1.5px solid ${BTN};border-radius:999px"><a href="${esc(url)}" style="display:inline-block;background:${BTN};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;line-height:1;padding:14px 26px;border-radius:999px">${esc(label)}</a></td></tr></table>`;

/** A small line of text links under the buttons, e.g. "Add to calendar: Apple or Outlook · Google". */
export const mailLinks = (lead: string, links: { label: string; url: string }[]) =>
  `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#5E6673">${esc(lead)}: ${links.map((l) => `<a href="${esc(l.url)}" style="color:#0E1116;font-weight:500">${esc(l.label)}</a>`).join(' · ')}</p>`;

/** The line at the bottom of a marketing message that lets the client stop receiving them. */
export const mailUnsub = (url: string) =>
  `<p style="margin:22px 0 0;font-size:12.5px;line-height:1.5;color:#5E6673">You are getting this because you agreed to hear from us. <a href="${esc(url)}" style="color:#5E6673">Unsubscribe</a></p>`;

/** A tinted box of label / value rows, e.g. Service, Date, Time. Empty values are left out. */
export function mailDetails(rows: [string, string | null | undefined][]) {
  const shown = rows.filter((r): r is [string, string] => !!r[1]);
  if (!shown.length) return '';
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;background:#F4F5F7;border-radius:14px;margin:4px 0 6px"><tbody>${shown.map(([l, v], i) =>
    `<tr><td style="padding:${i === 0 ? 14 : 5}px 0 ${i === shown.length - 1 ? 14 : 5}px 16px;font-size:13px;color:#5E6673;white-space:nowrap;vertical-align:top;width:1%">${esc(l)}</td><td style="padding:${i === 0 ? 14 : 5}px 16px ${i === shown.length - 1 ? 14 : 5}px 18px;font-size:14.5px;font-weight:500;color:#0E1116;vertical-align:top">${esc(v)}</td></tr>`).join('')}</tbody></table>`;
}

/** The plain-text twin of mailDetails. */
export const textDetails = (rows: [string, string | null | undefined][]) => rows.filter((r) => r[1]).map(([l, v]) => `${l}: ${v}`).join('\n');

/** Wraps a body in the shared frame. `body` is html that is already escaped; `footer` is plain text. */
export function mailShell(o: { brand: string; heading?: string; body: string; footer?: string; preheader?: string }) {
  const pre = o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#F4F5F7">${esc(o.preheader)}</div>` : '';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F4F5F7"><div style="background:#F4F5F7;padding:28px 12px;font-family:${FONT};color:#0E1116">${pre}`
    + `<div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:30px 28px">`
    + `<div style="font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#5E6673;margin-bottom:20px">${esc(o.brand)}</div>`
    + (o.heading ? `<h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:#0E1116">${esc(o.heading)}</h1>` : '')
    + o.body
    + `</div>`
    + `<div style="max-width:480px;margin:14px auto 0;text-align:center;font-size:12.5px;line-height:1.5;color:#5E6673">${esc(o.footer ?? o.brand)}</div></div></body></html>`;
}

/** Two buttons side by side: the main action in solid accent, the second a soft tint with an accent border (so it never looks see-through). */
export const mailButtonPair = (a: { label: string; url: string }, b: { label: string; url: string }) =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border-collapse:separate"><tr>`
  + `<td width="50%" style="padding-right:5px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate"><tr><td bgcolor="${BTN}" align="center" style="background:${BTN};border:1.5px solid ${BTN};border-radius:999px"><a href="${esc(a.url)}" style="display:block;text-align:center;background:${BTN};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14.5px;padding:13px 8px;border-radius:999px">${esc(a.label)}</a></td></tr></table></td>`
  + `<td width="50%" style="padding-left:5px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate"><tr><td bgcolor="#EEEAFE" align="center" style="background:#EEEAFE;border:1.5px solid ${BTN};border-radius:999px"><a href="${esc(b.url)}" style="display:block;text-align:center;background:#EEEAFE;color:#3A2BB5;text-decoration:none;font-weight:600;font-size:14.5px;padding:13px 8px;border-radius:999px">${esc(b.label)}</a></td></tr></table></td>`
  + `</tr></table>`;
