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
  readonly passed: boolean | null;
  readonly detail: string;
}

export interface Recorder {
  readonly record: (name: string, passed: boolean, detail: string) => void;
  readonly results: readonly CheckResult[];
}

export function createRecorder(): Recorder {
  const results: CheckResult[] = [];
  return {
    record: (name, passed, detail) => {
      results.push({ name, passed, detail });
    },
    results,
  };
}
