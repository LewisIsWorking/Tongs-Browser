#!/usr/bin/env node
/**
 * A docblock that documents nothing. Added 2026-08-12.
 *
 * ⚠️ COVERS: a `/** ... *\/` inside a class or function body immediately followed by another
 * docblock, which means the first one has no declaration under it.
 * ⚠️ MISSES: a docblock whose declaration was replaced by a DIFFERENT one, which still reads as
 * documentation and cannot be told apart mechanically.
 * ANCHORED: found by hand 2026-08-12 in TongsBrowser, where five blocks describing DragSampler's
 * fields, and three more describing PixiMoveProbe and DispatchTrace, had been left behind.
 * PROVEN: the self-test feeds it the exact shape and requires a failure, and `npm run lint:docblocks`
 *   RUNS it before the real check. Wired in 2026-08-30; until then the flag existed and nothing ever
 *   passed it, so this line claimed a proof only a hand-typed command could produce. Measured with
 *   the predicate stubbed to `return []`: unwired it printed "No orphaned docblocks across 319 files"
 *   and exited 0, wired it exits 1 on "SELF TEST FAILED".
 *
 * A comment is anchored to the declaration BELOW it. Move the declaration during a refactor and the
 * comment does not move with it: it silently re-anchors to whatever is next, so it goes on reading
 * as documentation of a field it has nothing to do with. Worse, if the extraction did not carry the
 * reasoning across, that orphan is the ONLY copy, and the next person to tidy it deletes it.
 *
 * File level headers are excluded, since a header followed by the first export's docblock is the
 * ordinary and correct shape. Only INDENTED blocks, which are inside a body, are candidates.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

interface Orphan {
  readonly file: string;
  readonly line: number;
  readonly firstLine: string;
}

export function findOrphanedDocblocks(source: string, file = ''): Orphan[] {
  const lines = source.split('\n');
  const orphans: Orphan[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    /*
     * ⚠️ TWO or more spaces of indent, not one, and the self test caught this on the first run.
     *
     * A file level docblock starts at column 0, so its continuation lines are ` *` and its closing
     * line carries exactly ONE space. A block inside a class body is indented, so its closing line
     * carries three. Matching a single space flags every file header in the repo that is followed by
     * its first export, which is the ordinary and correct shape, and the guard would then have had
     * to be turned off rather than trusted.
     */
    if (!/^\s{2,}/.test(line)) {
      continue;
    }

    /*
     * ⚠️ BOTH shapes of ending, and missing the second one hid two real orphans.
     *
     * A multi line block closes on a line of its own. A ONE LINE block closes on the same line it
     * opens, so a check for a lone closing marker walks straight past it. Both were sitting in
     * TongsBrowser, one line each, documenting fields that had moved into DragSampler.
     */
    const trimmed = line.trim();
    const isMultiLineEnd = trimmed === '*/';
    const isSingleLineBlock = trimmed.startsWith('/**') && trimmed.endsWith('*/');
    if (!isMultiLineEnd && !isSingleLineBlock) {
      continue;
    }

    let next = index + 1;
    while (next < lines.length && (lines[next] ?? '').trim() === '') {
      next += 1;
    }
    if (next >= lines.length || !(lines[next] ?? '').trim().startsWith('/**')) {
      continue;
    }

    // Walk back to the opening, so the message can name what is being orphaned.
    let open = index;
    while (open > 0 && !(lines[open] ?? '').trim().startsWith('/**')) {
      open -= 1;
    }
    orphans.push({
      file,
      line: open + 1,
      firstLine: (lines[isSingleLineBlock ? open : open + 1] ?? '')
        .replace(/^\s*\/?\*+\s?/, '')
        .slice(0, 72),
    });
  }

  return orphans;
}

/** ⚠️ The self test feeds it the exact shape, so a guard that cannot fail is caught here. */
function selfTest(): void {
  const bad = [
    'class A {',
    '  /**',
    '   * Orphan.',
    '   */',
    '',
    '  /** Real. */',
    '  x = 1;',
    '}',
  ];
  const good = ['/**', ' * File header.', ' */', '', '/** Real. */', 'export const x = 1;'];

  const found = findOrphanedDocblocks(bad.join('\n'), 'self-test');
  if (found.length !== 1) {
    console.error(
      `SELF TEST FAILED: expected 1 orphan in the bad sample, found ${String(found.length)}`
    );
    process.exit(1);
  }
  if (findOrphanedDocblocks(good.join('\n'), 'self-test').length !== 0) {
    console.error(
      'SELF TEST FAILED: a file header followed by a docblock was reported as an orphan'
    );
    process.exit(1);
  }
  console.log('Self test passed: the guard fails on an orphan and passes a file header.');
}

if (process.argv.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

const files = globSync(['src/**/*.ts', 'scripts/**/*.ts', 'tests/**/*.ts']);
const all = files.flatMap((file) => findOrphanedDocblocks(readFileSync(file, 'utf8'), file));

if (all.length > 0) {
  console.error(`${String(all.length)} docblock(s) documenting nothing:\n`);
  for (const orphan of all) {
    console.error(`  ${orphan.file}:${String(orphan.line)}  ${orphan.firstLine}`);
  }
  console.error(
    '\nA comment is anchored to the declaration BELOW it. If a refactor moved that declaration,\n' +
      'move the comment with it: it is often the only copy of the reasoning.'
  );
  process.exit(1);
}

console.log(`No orphaned docblocks across ${String(files.length)} files.`);
