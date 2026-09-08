/**
 * Mutations that MUST still be caught. Added 2026-09-03.
 *
 * Each entry is a defect that was, at some point, invisible to a green build: the code was at full
 * coverage, every test passed, and the wrong version of the line passed too. The test that closes it
 * is recorded here so that weakening that test breaks the build rather than quietly restoring the
 * hole.
 *
 * ⚠️ A coverage ratchet cannot do this job. Coverage asks whether a line RAN. Every mutation below
 * ran the line it changed, at 100% coverage, and still shipped a wrong answer.
 *
 * ⚠️ `find` is EXACT SOURCE TEXT and must appear exactly ONCE in the file. Line numbers were the
 * obvious alternative and are wrong: they rot on the first edit above them, and a stale number
 * mutates an innocent line, which produces a "survivor" that is really a mutation of nothing. An
 * ambiguous anchor is a hard error for the same reason, and it is the specific way a hand-rolled
 * version of this went wrong: `String.replace` silently mutated the first of two identical lines.
 *
 * ⚠️ `tests` must NAME the files to run rather than running everything. Not for speed: a mutation
 * killed by some unrelated test elsewhere is not evidence that the test recorded here still works.
 */
export interface RecordedMutation {
  /** Source file to mutate, repo relative. */
  readonly file: string;
  /** Exact text to replace. Must occur exactly once. */
  readonly find: string;
  /** What to put there instead. */
  readonly replace: string;
  /** What the mutation means, in the words of the bug it would ship. */
  readonly defect: string;
  /** The test files that must notice. */
  readonly tests: readonly string[];
}
