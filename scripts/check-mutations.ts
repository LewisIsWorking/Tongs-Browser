#!/usr/bin/env node
/**
 * Do the tests still catch the bugs they were written for? Added 2026-09-03.
 *
 * ⚠️ COVERS: a recorded defect that a green build once could not see. Each mutation in
 * `scripts/mutations/recorded.ts` is applied to the real source, the named tests are run, and the
 * mutation must be caught.
 * ⚠️ MISSES: defects nobody has thought of. This is not a mutation generator and does not search;
 * it pins the ones already found, so weakening the test that closed one breaks the build.
 * ANCHORED: found 2026-09-03 in `PartyAccessFlow`, where replacing a lookup with `readParties()[0]`
 *   passed all eleven of its tests at 100% coverage of that line, and passed a first attempt at the
 *   test written to close it. The line had never not been covered.
 * PROVEN: the self test feeds the verdict reader the exact output of a run where NO TEST RAN, which
 *   is the failure a hand-rolled version of this actually shipped: vitest exited 1 because the filter
 *   matched nothing, and the loop read a non-zero exit as a kill. It also proves the ambiguous anchor
 *   rule, which is the other way a hand-rolled version reported a mutation of the wrong line.
 *   PROVEN END TO END 2026-09-03, because a self test of the verdict reader is not a proof of the
 *   whole script. A mutation nothing asserts (the picker's title) was recorded temporarily, and the
 *   real run printed `❌ SURVIVED` and exited 1; a `find` occurring twice printed
 *   `⛔ AMBIGUOUS ANCHOR` and exited 1. The mutated source was verified restored after both, which is
 *   the branch that matters most: a failing run is exactly when a restore is easiest to skip.
 *   PROVEN AGAINST ITS OWN FIRST BUG, same day: the coloured summary check was confirmed by deleting
 *   the `stripAnsi` call, which makes it print "a coloured summary read as noTests" and exit 1. That
 *   bug was real and CI only, and every other check in this self test passed all the way through it,
 *   because they were written with the plain text that a piped local run produces.
 *
 * ⚠️ THIS SCRIPT EDITS SOURCE FILES and puts them back. It is safe to interrupt in the sense that the
 * restore is in a `finally` and is verified by content, but do not run it with unsaved work in an
 * editor that might write over the restore.
 */
import { countAnchor, readVerdict, runMutation } from './mutations/runner.ts';
import { RECORDED } from './mutations/recorded.ts';

function selfTest(): void {
  const killed = readVerdict('  Tests  1 failed | 10 passed (11)');
  if (killed.kind !== 'killed') {
    fail(`a run with a failure read as ${killed.kind}, not killed`);
  }

  const survived = readVerdict('  Tests  11 passed (11)');
  if (survived.kind !== 'survived') {
    fail(`a run where everything passed read as ${survived.kind}, not survived`);
  }

  /*
   * ⚠️ The one that matters. This is real output from a run that tested NOTHING, and a hand-rolled
   * version of this harness reported it as a kill because the process exited 1.
   */
  const nothing = readVerdict('No test files found, exiting with code 1\n');
  if (nothing.kind !== 'noTests') {
    fail(`a run where no test executed read as ${nothing.kind}, not noTests`);
  }

  /*
   * ⚠️ The SAME summary wearing colour, which is what CI actually sends. This is not a hypothetical:
   * on 2026-09-03 three mutations that were genuinely killed were reported as "no tests ran", on CI
   * only, because GitHub Actions forces colour on and `^\s*Tests` cannot match a line beginning with
   * an escape sequence. Every check above this one passed throughout, because they were written with
   * the plain text a piped local run produces.
   */
  const coloured = readVerdict(
    '\u001B[2m  Tests \u001B[22m \u001B[31m1 failed\u001B[39m | 10 passed (11)'
  );
  if (coloured.kind !== 'killed') {
    fail(
      `a coloured summary read as ${coloured.kind}, not killed. CI sends colour; a local pipe does not`
    );
  }

  if (countAnchor('const a = 1;\nconst a = 1;\n', 'const a = 1;') !== 2) {
    fail('a duplicated anchor was not counted twice, so an ambiguous mutation would be applied');
  }

  console.log(
    'Self test passed: a failure is a kill (in colour too), all-passing is a survivor, no tests is neither, and a duplicated anchor is counted.'
  );
}

/** ⚠️ The evidence, indented so it reads as quoted output rather than as this script's own words. */
function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => `   | ${line}`)
    .join('\n');
}

function fail(why: string): never {
  console.error(`SELF TEST FAILED: ${why}`);
  process.exit(1);
}

if (process.argv.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

let bad = 0;
for (const mutation of RECORDED) {
  const verdict = runMutation(mutation);
  const where = `${mutation.file}: ${mutation.defect}`;

  if (verdict.kind === 'killed') {
    console.log(`✅ ${where}\n   caught by: ${verdict.by.join('; ')}`);
    continue;
  }

  bad += 1;
  if (verdict.kind === 'survived') {
    console.error(
      `❌ SURVIVED  ${where}\n   ${mutation.tests.join(', ')} all passed with it applied.`
    );
  } else if (verdict.kind === 'noTests') {
    console.error(
      `⛔ NO TESTS RAN  ${where}\n   Nothing was measured. What the run printed instead:\n${indent(verdict.output)}`
    );
  } else {
    console.error(
      `⛔ AMBIGUOUS ANCHOR  ${where}\n   Found ${String(verdict.occurrences)} times, needs exactly 1.`
    );
  }
}

if (bad > 0) {
  console.error(
    `\n${String(bad)} of ${String(RECORDED.length)} recorded mutations were not caught.`
  );
  process.exit(1);
}
console.log(`\nAll ${String(RECORDED.length)} recorded mutations still caught.`);
