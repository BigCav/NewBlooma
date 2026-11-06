// Step flows where some steps are not needed (nobody to choose between, so no "pick a team member" step).

/** The step to land on when moving `dir` from step `n`, passing over steps that are not needed. The first and last step are never passed over. */
export function hop(n: number, dir: 1 | -1, last: number, skip: readonly number[]): number {
  while (n > 0 && n < last && skip.includes(n)) n += dir;
  return n;
}

/** The titles the progress bar shows, and where the current step sits among them, when some steps are passed over. */
export function visible(titles: readonly string[], skip: readonly number[], step: number) {
  return { titles: titles.filter((_, i) => !skip.includes(i)), at: step - skip.filter((i) => i < step).length };
}
