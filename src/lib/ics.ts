// "Add to calendar" for one appointment: an .ics file (Apple Calendar, Outlook, most phones) and a Google Calendar link.
// Times go out in UTC, so every calendar shows the appointment at the right local time wherever the client is.
export type CalEvent = { uid: string; start: string | Date; end: string | Date; title: string; description?: string; location?: string; url?: string };

const stamp = (d: string | Date) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** A line longer than 75 bytes continues on the next line after a single space. Cut on whole characters, never through a multi-byte one. */
function fold(line: string) {
  const out: string[] = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function icsFile(e: CalEvent, now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aster//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`, `SUMMARY:${text(e.title)}`,
    ...(e.description ? [`DESCRIPTION:${text(e.description)}`] : []),
    ...(e.location ? [`LOCATION:${text(e.location)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleCalUrl(e: CalEvent) {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${stamp(e.start)}/${stamp(e.end)}` });
  if (e.description) q.set('details', e.description);
  if (e.location) q.set('location', e.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}
