// One look for every email the site sends: grey page, white card, brand name on top, optional heading, body, buttons, small footer.
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** A paragraph of body text. Newlines inside it become line breaks. */
export const mailP = (text: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#0E1116">${esc(text).replace(/\n/g, '<br>')}</p>`;

/** A small grey note under the body. */
export const mailNote = (text: string) => `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#5E6673">${esc(text).replace(/\n/g, '<br>')}</p>`;

/** A pill button. "primary" is the accent colour, "dark" is for a second action next to it. */
export const mailButton = (label: string, url: string, tone: 'primary' | 'dark' = 'primary') =>
  `<p style="margin:20px 0 0"><a href="${esc(url)}" style="display:inline-block;background:${tone === 'primary' ? '#5B3DF5' : '#0E1116'};color:#FFFFFF;text-decoration:none;font-weight:500;font-size:15px;line-height:1;padding:14px 26px;border-radius:999px">${esc(label)}</a></p>`;

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
