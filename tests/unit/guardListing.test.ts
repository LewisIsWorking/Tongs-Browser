import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { listSourceFiles } from '../../scripts/sizes/listing.ts';

/**
 * Every guard must be able to see a file that has just been written.
 *
 * ⚠️ THIS EXISTS BECAUSE THE SAME BLIND SPOT WAS FOUND TWICE. `git ls-files` reports TRACKED files
 * only, so a file created moments ago is invisible until it is staged. A guard with that listing
 * passes locally and fails in CI, or worse, passes in both while never having looked.
 *
 * Found in `check:sizes` on 2026-08-18, when a 212 line test file went green locally and red in CI.
 * Fixed there and in `check:readmes`, and the lesson was written down as "a blind spot found in one
 * guard is worth looking for in every guard that shares the technique" - and then not acted on.
 * `check:support` still had it on 2026-08-22, four days later, and reported "All 9 shared test
 * fixture(s) are imported somewhere" with an unadopted fixture sitting in the folder.
 *
 * A lesson recorded in prose did not survive. This is the same lesson as a predicate.
 */
const GUARDS = listSourceFiles().filter(
  (file) => file.startsWith('scripts/check-') && file.endsWith('.ts')
);

describe('how the guards enumerate files', () => {
  it('finds the guards to check, so this cannot silently examine nothing', () => {
    expect(GUARDS.length).toBeGreaterThan(4);
  });

  /**
   * ⚠️ COMMENTS ARE STRIPPED FIRST, and the first version of this test did not do it. Two guards
   * failed immediately because they MENTION `ls-files` in a comment explaining the very blind spot
   * this test exists for. A comment is not a caller - a rule already written down in
   * `src/debug/README.md`, and still worth re-learning at the cost of one red run.
   */
  const withoutComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  /**
   * ⚠️ `--others` is what adds untracked files, and `--exclude-standard` keeps gitignored ones out.
   * A guard may call `git ls-files` directly as long as it asks for both; the shared
   * `listSourceFiles` already does.
   */
  it.each(GUARDS)('%s can see a file that has not been staged yet', (guard) => {
    const source = withoutComments(readFileSync(guard, 'utf8'));
    if (!source.includes('ls-files')) {
      // Uses listSourceFiles or a filesystem glob, both of which see untracked files.
      return;
    }

    expect(source).toContain('--others');
    expect(source).toContain('--exclude-standard');
  });
});
