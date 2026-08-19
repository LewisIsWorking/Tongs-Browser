import { execFileSync } from 'node:child_process';

/**
 * Which files the size guard looks at. Extracted from check-file-sizes 2026-08-19.
 *
 * ⚠️ TRACKED **AND** UNTRACKED, and the second half exists because its absence gave a FALSE GREEN on
 * exactly the case that matters most: a brand new file.
 *
 * `git ls-files` lists tracked files only. A file just written and not yet staged is invisible to the
 * guard, so `npm run verify` passes and the limit is enforced only once the file is committed, by
 * which point CI is the thing that tells you, after a push and a round trip.
 *
 * That happened: a 212 line test file passed verify locally and failed in CI moments later. The guard
 * was not wrong about anything it looked at. It just never looked.
 *
 * `--others --exclude-standard` adds the untracked files that are not gitignored, which is the set a
 * developer has actually created.
 */
function run(args: string[]): string[] {
  return execFileSync('git', args, { encoding: 'utf8' })
    .split('\n')
    .filter((file) => file !== '' && !file.endsWith('.d.ts'));
}

/**
 * Every TypeScript file the guard should judge, deduplicated.
 *
 * A path can appear in both lists during a rename, so the set is not decorative.
 */
export function listSourceFiles(): string[] {
  return [
    ...new Set([
      ...run(['ls-files', '*.ts']),
      ...run(['ls-files', '--others', '--exclude-standard', '*.ts']),
    ]),
  ];
}
