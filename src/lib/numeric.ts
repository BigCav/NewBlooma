/** Keeps only digits. For counts such as minutes or units of stock. */
export const digitsInput = (v: string) => v.replace(/\D/g, '');
/** Keeps digits and a single decimal point with at most two decimals. For dollar amounts and rates. */
export const decimalInput = (v: string) => {
  const t = v.replace(/[^0-9.]/g, '');
  const i = t.indexOf('.');
  return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '').slice(0, 2);
};
