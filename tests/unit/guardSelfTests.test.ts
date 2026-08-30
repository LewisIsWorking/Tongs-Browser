import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { listSourceFiles } from '../../scripts/sizes/listing.ts';

/**
 * A guard that ships a `--self-test` must have something that RUNS it.
 *
 * ⚠️ THE SHAPE THIS EXISTS FOR: `check-orphaned-docblocks.ts` carried the line
 * "PROVEN: `npm run lint:docblocks -- --self-test` feeds it the exact shape and requires a failure."
 * That command works when typed by hand, and it was typed by hand once, in the commit that wrote the
 * claim. `npm run verify` never typed it, and neither did CI. The proof existed only in the past
 * tense, so the self-test could have rotted to a no-op and nothing would have gone red.
 *
 * Found 2026-08-22, auditing the guards after the SAME sweep found the untracked-files blind spot in
 * `check:support`. `--self-test` was wired into `check:sizes` on 2026-08-18 with the note that it
 * "was reachable only by hand", and the two other guards that had one were left alone. Third time a
 * fix landed on one user of a shared technique and not the rest.
 *
 * COVERS: a guard whose source implements `--self-test` while no npm script passes the flag.
 * MISSES: a guard with no self-test at all. `check:support` and `lint:prose` are in that state by
 *   omission rather than by decision, and this test deliberately does not demand one - a self-test
 *   is worth writing when the guard's own logic is intricate enough to break silently, which is a
 *   judgement, not a rule. What it does forbid is writing one and leaving it unreachable.
 */
const GUARD_SOURCES = listSourceFiles().filter(
  (file) => file.startsWith('scripts/check-') && file.endsWith('.ts')
);

interface GuardScript {
  readonly guard: string;
  readonly script: string;
  readonly command: string;
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
};

/**
 * ⚠️ Matched from the SCRIPT side, not the guard side. A guard file that no npm script mentions is a
 * separate fault and belongs to `check:scripts`; this test only asks whether the scripts that DO run
 * a guard run its self-test too.
 */
const runners: GuardScript[] = [];
for (const [script, command] of Object.entries(packageJson.scripts)) {
  for (const guard of GUARD_SOURCES) {
    if (command.includes(guard)) {
      runners.push({ guard, script, command });
    }
  }
}

const implementsSelfTest = (guard: string): boolean =>
  readFileSync(guard, 'utf8').includes("'--self-test'");

describe('the guards that guard the guards', () => {
  it('finds the npm scripts that run a guard, so this cannot silently examine nothing', () => {
    expect(runners.length).toBeGreaterThan(4);
  });

  it.each(runners.map((one) => [one.script, one.guard, one.command]))(
    '%s runs the self-test that %s implements',
    (_script, guard, command) => {
      if (!implementsSelfTest(guard)) {
        // No self-test to run. See MISSES above: having one is a judgement, hiding one is not.
        return;
      }

      expect(command).toContain('--self-test');
    }
  );

  /**
   * ⚠️ The self-test alone is NOT the check. Every one of them ends in `process.exit(0)` so that a
   * passing self-test does not then report the repo's real violations as its own exit code. Wiring a
   * guard in as `--self-test` and nothing else would therefore be strictly worse than before: green
   * every time, having looked at nothing. The chained form is what keeps both halves.
   */
  it.each(runners.map((one) => [one.script, one.guard, one.command]))(
    '%s still runs %s against the repo, not only against its own fixtures',
    (_script, guard, command) => {
      if (!command.includes('--self-test')) return;

      const withoutSelfTest = command
        .split('&&')
        .map((part) => part.trim())
        .filter((part) => part.includes(guard) && !part.includes('--self-test'));

      expect(withoutSelfTest).not.toHaveLength(0);
    }
  );
});
