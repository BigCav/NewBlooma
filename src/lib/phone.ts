/** Phone numbers are digits only, with an optional leading + for international numbers. Safe to import from client and server code. */
export const PHONE_MSG = 'Phone numbers can only contain numbers (7 to 15 digits).';

/** Strips anything that is not a digit as the person types; a + is kept only as the first character. */
export const phoneInput = (v: string) => {
  const t = v.replace(/[^\d+]/g, '');
  return (t.startsWith('+') ? '+' : '') + t.replace(/\+/g, '');
};

/** Validates a phone number and returns it cleaned up. Spaces, dashes and brackets are tolerated, letters are not. */
export function checkPhone(raw: string, required = false): { value: string; error: string } {
  const t = (raw ?? '').trim();
  if (!t) return { value: '', error: required ? 'Add a phone number.' : '' };
  if (/[^\d+\s()-]/.test(t)) return { value: t, error: PHONE_MSG };
  const value = phoneInput(t);
  return { value, error: /^\+?\d{7,15}$/.test(value) ? '' : PHONE_MSG };
}
