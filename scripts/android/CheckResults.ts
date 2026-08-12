/**
 * Recording what a check found, and being honest about what it did not. Extracted from
 * foundry-android-check 2026-08-12.
 */
/**
 * One check outcome.
 *
 * `passed: null` is a SKIP and is deliberately not a boolean, so a skip can never be mistaken for a
 * pass by a reader or by a filter. See the skip helper for why that distinction is load bearing.
 */
export interface CheckResult {
  readonly name: string;
  readonly passed: boolean | null;
  readonly detail: string;
}

export const results: CheckResult[] = [];

export function record(name: string, passed: boolean, detail: string): void {
  results.push({ name, passed, detail });
}

/**
 * A skip is recorded as its own outcome, never as a pass.
 *
 * The emulator image available here runs Chromium 133 against a Foundry that wants 146, so a canvas
 * that never becomes ready is a plausible outcome rather than an impossible one. Reporting that as
 * green would be the worst available answer: it would claim coverage of exactly the gesture work
 * that is hardest to verify and easiest to break.
 */
export function skip(name: string, reason: string): void {
  results.push({ name, passed: null, detail: `SKIPPED: ${reason}` });
}

/**
 * Say what went wrong, whatever was thrown.
 *
 * ⚠️ `error.message` alone is not safe here. A rejected page evaluate can throw a string, and Foundry
 * itself throws plain objects in places, so reading `.message` off the value gives `undefined` for a
 * string and throws outright for null. The reason then reads "SKIPPED: undefined", which is the exact
 * shape of a skip that tells nobody anything.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : JSON.stringify(error);
}
