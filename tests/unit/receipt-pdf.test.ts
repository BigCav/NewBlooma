import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { cardReceiptPdf } from '@/lib/receipt-pdf';

const LINES = ['*---------EFTPOS----------*', 'PURCHASE            NZD160.00', '', '          APPROVED', '        CUSTOMER COPY'];

describe('cardReceiptPdf', () => {
  it('makes one page the width of an 80mm roll', async () => {
    const bytes = await cardReceiptPdf(LINES, 30);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(226.8, 1);
    expect(height).toBeGreaterThanOrEqual(120);
  });
  it('a longer receipt makes a taller page, not a second one', async () => {
    const doc = await PDFDocument.load(await cardReceiptPdf(Array.from({ length: 60 }, (_, i) => 'LINE ' + i), 30));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize().height).toBeGreaterThan(300);
  });
  it('a character the font cannot draw does not stop the receipt', async () => {
    const bytes = await cardReceiptPdf(['TOTAL €10.00 中', 'café'], 30);
    expect(bytes.length).toBeGreaterThan(500);
  });
  it('a wide receipt is shrunk to fit the roll', async () => {
    const doc = await PDFDocument.load(await cardReceiptPdf(['X'.repeat(48)], 48));
    expect(doc.getPage(0).getSize().width).toBeCloseTo(226.8, 1);
  });
});
