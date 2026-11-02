// The colours of status chips and tags, defined once: a pale background with a dark text of the same hue.
// Anything that is a status (booking, payment, message type, stock, gift card) picks one of these, so the same meaning is the same colour everywhere.
export const TONE = {
  green: { bg: '#DDF3EA', fg: '#14624A' },
  amber: { bg: '#FFEBD0', fg: '#7A4204' },
  red: { bg: '#FCE3E3', fg: '#9B1C1C' },
  purple: { bg: '#EEEAFE', fg: '#3A2BB5' },
  blue: { bg: '#E9F0FF', fg: '#1B4A8A' },
  grey: { bg: '#EEF0F3', fg: '#4A525E' },
} as const;
