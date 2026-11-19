import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/** Characters the PDF's built-in Courier can draw (printable ASCII and Latin-1); anything else is drawn as "?" rather than failing the whole receipt. */
const drawable = (t: string) => [...t].map((c) => { const n = c.charCodeAt(0); return (n >= 32 && n <= 126) || (n >= 160 && n <= 255) ? c : n === 9 ? ' ' : '?'; }).join('');

/**
 * The terminal's EFTPOS receipt as a PDF, one page the width of an 80mm receipt roll, the lines exactly as the terminal sent them
 * in a monospace font and the block centred on the page.
 */
export async function cardReceiptPdf(lines: string[], width: number, title = 'Card receipt'): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const font = await doc.embedFont(StandardFonts.Courier);
  const pageW = 226.8; // 80mm in points
  const margin = 16;
  const widest = Math.max(width, ...lines.map((l) => l.length), 1);
  const size = Math.min(10, (pageW - margin * 2) / (0.6 * widest)); // Courier is 0.6 em per character
  const lh = size * 1.3;
  const pageH = Math.max(120, margin * 2 + lines.length * lh);
  const x0 = (pageW - widest * 0.6 * size) / 2;
  const page = doc.addPage([pageW, pageH]);
  lines.forEach((l, i) => page.drawText(drawable(l), { x: x0, y: pageH - margin - size - i * lh, size, font, color: rgb(0, 0, 0) }));
  return doc.save();
}
