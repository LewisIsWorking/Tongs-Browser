import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

import type { RecordedMutation } from './recorded.ts';

/**
 * Applying one mutation and asking whether the tests noticed. Added 2026-09-03.
 *
 * ⚠️ The verdict is read from vitest's SUMMARY LINE, never from its exit code. A hand-rolled version
 * of this reported a kill that never happened: it passed a label where vitest expected a filter, no
 * test matched, vitest exited 1, and the loop read that as the mutation being caught. A non-zero exit
 * means "something went wrong", and "no tests ran at all" is the most likely something.
 */
const SUMMARY = /^\s*Tests\s+(?:(\d+) failed \| )?(\d+) passed/m;

export type Verdict =
  | { readonly kind: 'killed'; readonly failed: number; readonly by: readonly string[] }
  | { readonly kind: 'survived' }
  /**
   * ⚠️ Carries the OUTPUT, not just the verdict. The first version reported "Nothing was measured"
   * and stopped there, which is a diagnosis with the evidence thrown away: it says a run produced no
   * summary line without saying what it produced instead. CI found this immediately, on a failure
   * that could not be reproduced from the message alone.
   */
  | { readonly kind: 'noTests'; readonly output: string }
  | { readonly kind: 'badAnchor'; readonly occurrences: number };

/** How many times the anchor appears. Exported so the self test can prove the ambiguity rule. */
export function countAnchor(source: string, find: string): number {
  return source.split(find).length - 1;
}

export function runMutation(mutation: RecordedMutation): Verdict {
  const original = readFileSync(mutation.file, 'utf8');
  const occurrences = countAnchor(original, mutation.find);
  if (occurrences !== 1) {
    return { kind: 'badAnchor', occurrences };
  }

  let restored: boolean;
  let verdict: Verdict;
  try {
    writeFileSync(mutation.file, original.replace(mutation.find, mutation.replace));
    verdict = readVerdict(runVitest(mutation.tests));
  } finally {
    /*
     * ⚠️ Restored in a `finally` and then CHECKED, because the cost of getting this wrong is a
     * mutated source file left in the working tree. `git diff` is no help for a file git does not
     * track yet, which is exactly the state a new file is in while its mutations are being written.
     *
     * ⚠️ It LOGS here and THROWS below, rather than throwing here. A throw inside `finally` replaces
     * whatever exception was already propagating, so a crash in vitest would surface as a restore
     * message and the real cause would be gone. Logging is safe in `finally`; throwing is not. The
     * log matters on its own, because the case where the body threw never reaches the throw below.
     */
    writeFileSync(mutation.file, original);
    restored = readFileSync(mutation.file, 'utf8') === original;
    if (!restored) {
      console.error(`⛔ COULD NOT RESTORE ${mutation.file}. Check it before committing.`);
    }
  }

  if (!restored) {
    throw new Error(`Could not restore ${mutation.file}. Check it before committing.`);
  }
  return verdict;
}

/**
 * ⚠️ Vitest's own module through Node, not `npx` through a shell. `npx` needs `shell: true` on
 * Windows to find its `.cmd`, and that concatenates arguments rather than escaping them, which Node
 * warns about and which would put file paths from a list into a command line unquoted.
 */
function runVitest(tests: readonly string[]): string {
  try {
    return execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...tests], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (error) {
    /* A failing run is the expected case here, and its output is the whole point. */
    const failure = error as { stdout?: string; stderr?: string };
    return `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
  }
}

export function readVerdict(output: string): Verdict {
  const summary = SUMMARY.exec(output);
  if (summary === null) {
    return { kind: 'noTests', output: lastLines(output) };
  }

  const failed = Number(summary[1] ?? '0');
  if (failed === 0) {
    return { kind: 'survived' };
  }
  return { kind: 'killed', failed, by: namesOfFailures(output) };
}

/** The tail of a run that produced no summary, which is where the reason for that usually is. */
function lastLines(output: string): string {
  return output.trim().split('\n').slice(-12).join('\n');
}

/** ⚠️ WHICH tests failed, not just how many. A mutation killed by an unrelated test is a coincidence. */
function namesOfFailures(output: string): readonly string[] {
  return output
    .split('\n')
    .filter((line) => /^\s*×\s/.test(line))
    .map((line) => line.replace(/^\s*×\s*/, '').replace(/\s+\d+ms\s*$/, ''))
    .slice(0, 4);
}
