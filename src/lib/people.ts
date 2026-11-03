// How a person's name becomes initials, defined once so a client reads "JD" on every screen.

/** Up to `max` capital letters from the first words of a name. Words that do not start with a letter or digit (a bracket, a dash) are skipped. */
export function initialsOf(name: string | null | undefined, opts: { max?: number; fallback?: string } = {}): string {
  const { max = 2, fallback = '?' } = opts;
  const out = (name ?? '').split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w)).slice(0, max).map((w) => w[0]).join('').toUpperCase();
  return out || fallback;
}

/** The first word of a name ("Cav" from "Cav Allen"), or a fallback when there is no name. */
export function firstName(name: string | null | undefined, fallback = 'there'): string {
  return (name ?? '').trim().split(/\s+/)[0] || fallback;
}
