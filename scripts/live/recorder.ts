/**
 * Collecting what each live check decided. Extracted from foundry-live-check 2026-08-12.
 *
 * ⚠️ HANDED to each check, rather than a module level array they all reach for. Splitting checks
 * across files while they shared a module scoped `results` is the kind of change that appears to
 * work: each check still runs and still passes, and the only symptom is that some of them quietly
 * stop appearing in the report. A recorder that has to be passed in cannot be got wrong quietly.
 */
export interface CheckResult {
  readonly name: string;
  /** `null` is a SKIP: the check could not be exercised, which is not the same as failing it. */
  readonly passed: boolean | null;
  readonly detail: string;
}

export interface Recorder {
  readonly record: (name: string, passed: boolean, detail: string) => void;
  /**
   * The check could not be run at all, which is the HARNESS's fault and not the module's.
   *
   * ⚠️ This existed only as a comment until 2026-08-12, and its absence was actively harmful. Three
   * harnesses documented `passed: null` as "a SKIP, deliberately not a boolean, so it can never be
   * mistaken for a pass", and not one of them could produce a null. The one place that genuinely
   * wanted it did this instead:
   *
   *     record('touching the chat log leaves the pointer alone', false,
   *            'no chat region with a usable box, so the exclusion could not be exercised')
   *
   * A FALSE whose own detail says it could not be exercised. The harness failed to find a chat log
   * and reported it as the module failing to leave the pointer alone, which is a failure pointed at
   * the wrong party. A run that cannot set its world up must say so, never blame the code.
   */
  readonly skip: (name: string, detail: string) => void;
  readonly results: readonly CheckResult[];
}

export function createRecorder(): Recorder {
  const results: CheckResult[] = [];
  return {
    record: (name, passed, detail) => {
      results.push({ name, passed, detail });
    },
    skip: (name, detail) => {
      results.push({ name, passed: null, detail });
    },
    results,
  };
}

/**
 * ⚠️ `=== false`, NOT `!passed`. A skip is falsy, so every one of the three harnesses counted a
 * would-be skip as a failure and printed FAIL against it. That is the bug the skip helper exists to
 * make impossible, and writing the test as truthiness would reintroduce it in one character.
 */
export function isFailure(result: CheckResult): boolean {
  return result.passed === false;
}

/** PASS, FAIL or SKIP: three outcomes, because two cannot express "not asked". */
export function describeOutcome(result: CheckResult): string {
  if (result.passed === null) {
    return 'SKIP';
  }
  return result.passed ? 'PASS' : 'FAIL';
}
