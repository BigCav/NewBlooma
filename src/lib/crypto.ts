import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key() {
  const b = Buffer.from(process.env.APP_ENCRYPTION_KEY ?? '', 'base64');
  if (b.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be 32 bytes, base64 encoded');
  return b;
}
/** AES-256-GCM. Output: base64(iv | tag | ciphertext). */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
export function decrypt(blob: string) {
  const raw = Buffer.from(blob, 'base64');
  const d = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}
