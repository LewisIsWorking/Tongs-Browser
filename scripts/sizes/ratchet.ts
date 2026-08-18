/**
 * Deciding what counts as too long, and what a ratchet may record. Extracted from check-file-sizes
 * 2026-08-13, when the guard caught ITSELF crossing the limit it enforces.
 *
 * Separated from the command line so the rules can be self tested against made up inputs rather than
 * against whatever the repository happens to look like today. A guard proved only by the repo passing
 * is a guard that stops proving anything the moment the repo is clean.
 */
export const LIMIT = 200;

/** Line count the same way the project counts everywhere else: newline separated, trailing blank included. */
export function countLines(source: string): number {
  return source.split('\n').length;
}

export interface SizeProblem {
  readonly file: string;
  readonly lines: number;
  readonly ceiling: number;
  readonly reason: 'over the hard limit' | 'grew past its ratchet' | 'has slack below its ratchet';
}

/**
 * ⚠️ `src/` is judged against the LIMIT, everything else against its recorded ceiling. A file with
 * no entry is judged against the limit too, so a new test file cannot be born over 200 and quietly
 * inherit backlog treatment.
 *
 * ⚠️ SLACK IS A PROBLEM TOO, added 2026-08-18. This checked only `lines > ceiling`, which meant a file
 * that SHRANK kept its old ceiling until somebody remembered to run `--update`. That is exactly the
 * high water mark this file's own docblock warns against: shrink DragToken.ts from 284 to 230, the
 * check reports green, the ceiling stays 284, and the file may silently regrow every one of those 54
 * lines. A ratchet that only tightens when asked is a ratchet that does not tighten.
 *
 * Reporting it as a failure rather than a note is deliberate. The fix is one command, printed with
 * the message, and a warning nobody is forced to act on is how the slack accumulated in the first
 * place.
 */
export function findProblems(
  sizes: ReadonlyMap<string, number>,
  ratchet: Readonly<Record<string, number>>
): SizeProblem[] {
  const problems: SizeProblem[] = [];
  for (const [file, lines] of sizes) {
    const recorded = file.startsWith('src/') ? undefined : ratchet[file];
    const ceiling = recorded ?? LIMIT;
    if (lines > ceiling) {
      problems.push({
        file,
        lines,
        ceiling,
        reason: recorded === undefined ? 'over the hard limit' : 'grew past its ratchet',
      });
      continue;
    }
    if (recorded !== undefined && lines < recorded) {
      problems.push({ file, lines, ceiling, reason: 'has slack below its ratchet' });
    }
  }
  return problems;
}

/**
 * Whether every problem is slack, meaning the tree is smaller than recorded and nothing has grown.
 *
 * Kept separate so the caller can print a different instruction. "Extract a responsibility into its
 * own file" is the right advice for a file that grew and precisely the wrong advice for one that
 * shrank, and a guard that answers a success with the remedy for a failure teaches people to stop
 * reading it.
 */
export function onlySlack(problems: readonly SizeProblem[]): boolean {
  return (
    problems.length > 0 && problems.every((one) => one.reason === 'has slack below its ratchet')
  );
}

/** Entries whose file has been deleted or has dropped below the limit are dropped from the list. */
export function tightened(
  sizes: ReadonlyMap<string, number>,
  ratchet: Readonly<Record<string, number>>
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [file, lines] of sizes) {
    if (lines <= LIMIT || file.startsWith('src/')) {
      continue;
    }
    next[file] = Math.min(lines, ratchet[file] ?? lines);
  }
  return next;
}

export function selfTest(): void {
  const sizes = new Map([
    ['src/a.ts', 201],
    ['tests/b.test.ts', 300],
    ['tests/c.test.ts', 301],
    ['tests/d.test.ts', 10],
  ]);
  const ratchet = { 'tests/b.test.ts': 300, 'tests/c.test.ts': 300 };

  const problems = findProblems(sizes, ratchet);
  const files = problems.map((problem) => problem.file).sort();
  if (files.join(',') !== 'src/a.ts,tests/c.test.ts') {
    console.error(
      `SELF TEST FAILED: expected src/a.ts and tests/c.test.ts, got ${files.join(',')}`
    );
    process.exit(1);
  }

  /* ⚠️ A src/ file must NOT be excusable by a ratchet entry, or the strict half quietly becomes the loose half. */
  if (findProblems(new Map([['src/a.ts', 201]]), { 'src/a.ts': 500 }).length !== 1) {
    console.error('SELF TEST FAILED: a ratchet entry excused a src/ file');
    process.exit(1);
  }

  /* ⚠️ The ratchet may only ever record a REDUCTION. */
  const next = tightened(new Map([['tests/b.test.ts', 250]]), { 'tests/b.test.ts': 300 });
  if (next['tests/b.test.ts'] !== 250) {
    console.error(
      `SELF TEST FAILED: a reduction was not recorded, got ${String(next['tests/b.test.ts'])}`
    );
    process.exit(1);
  }
  if (
    tightened(new Map([['tests/b.test.ts', 350]]), { 'tests/b.test.ts': 300 })[
      'tests/b.test.ts'
    ] !== 300
  ) {
    console.error('SELF TEST FAILED: an increase was recorded as a new ceiling');
    process.exit(1);
  }

  /*
   * ⚠️ Slack is a FAILURE, not a pass. Added 2026-08-18 with the rule itself, and proved by feeding
   * the guard the exact bug: a file recorded at 300 now measuring 250 used to report nothing at all.
   */
  const slack = findProblems(new Map([['tests/b.test.ts', 250]]), { 'tests/b.test.ts': 300 });
  if (slack[0]?.reason !== 'has slack below its ratchet') {
    console.error(
      `SELF TEST FAILED: a shrunken file was not reported, got ${slack[0]?.reason ?? 'nothing'}`
    );
    process.exit(1);
  }
  if (!onlySlack(slack) || onlySlack([])) {
    console.error('SELF TEST FAILED: slack was not distinguishable from growth');
    process.exit(1);
  }

  console.log(
    'Self test passed: the limit is strict for src/, and the ratchet tightens in both directions.'
  );
}
