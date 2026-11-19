/**
 * Prints receipt lines on the computer's receipt printer (choose it in the print window; a browser started with kiosk printing prints straight away).
 * The text is printed as it is: one fixed-width line per line, in a monospace font sized so the widest line fits an 80mm roll.
 */
export function printReceipt(lines: string[], width: number) {
  const widest = Math.max(width, ...lines.map((l) => l.length), 1);
  const mm = Math.min(4, 72 / (0.6 * widest));
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return; }
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>@page{size:80mm auto;margin:4mm}html,body{margin:0;background:#fff}pre{margin:0;font:${mm.toFixed(2)}mm/1.25 "Courier New",Courier,monospace;white-space:pre;color:#000}</style></head><body><pre>${esc(lines.join('\n'))}</pre></body></html>`);
  doc.close();
  win.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 300));
  setTimeout(() => { win.focus(); win.print(); }, 60);
  setTimeout(() => frame.remove(), 120000);
}
