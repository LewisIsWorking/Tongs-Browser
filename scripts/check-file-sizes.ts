#!/usr/bin/env node
/**
 * The 200 line limit, enforced rather than remembered. Added 2026-08-12.
 *
 * `src/` is held at the real limit with no exceptions, because it is now genuinely clear. Tests and
 * harness scripts carry a backlog that cannot be cleared in one pass, so they are held by a ratchet
 * instead: each file's CURRENT length is the ceiling, and any growth fails.
 *
 * ⚠️ The ceiling is the CURRENT length, not a round number above it, and the difference is the whole
 * point. A ratchet parked at a comfortable margin is a high water mark: it permits every file to
 * regrow to its worst ever size while reporting green the entire way. `npm run check:sizes -- --update`
 * rewrites the list, and it can only ever be run to record a REDUCTION, because an increase fails the
 * check before it can be recorded.
 *
 * Run: npm run check:sizes
 *      npm run check:sizes -- --update     (after shrinking something)
 *      npm run check:sizes -- --self-test
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export const LIMIT = 200;
const RATCHET_FILE = 'scripts/file-size-ratchet.json';

/** Line count the same way the project counts everywhere else: newline separated, trailing blank included. */
export function countLines(source: string): number {
  return source.split('\n').length;
}

export interface SizeProblem {
  readonly file: string;
  readonly lines: number;
  readonly ceiling: number;
  readonly reason: 'over the hard limit' | 'grew past its ratchet';
}

/**
 * ⚠️ `src/` is judged against the LIMIT, everything else against its recorded ceiling. A file with
 * no entry is judged against the limit too, so a new test file cannot be born over 200 and quietly
 * inherit backlog treatment.
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
    }
  }
  return problems;
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

function selfTest(): void {
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

  console.log(
    'Self test passed: the limit is strict for src/, and the ratchet only ever tightens.'
  );
}

if (process.argv.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

const tracked = execFileSync('git', ['ls-files', '*.ts'], { encoding: 'utf8' })
  .split('\n')
  .filter((file) => file !== '' && !file.endsWith('.d.ts'));

const sizes = new Map(tracked.map((file) => [file, countLines(readFileSync(file, 'utf8'))]));
const ratchet: Record<string, number> = existsSync(RATCHET_FILE)
  ? (JSON.parse(readFileSync(RATCHET_FILE, 'utf8')) as Record<string, number>)
  : {};

/*
 * ⚠️ `--seed` is SEPARATE from `--update`, and deliberately awkward to reach for.
 *
 * A ratchet cannot record its own starting point using the rule that only permits reductions: on the
 * first run every backlog file is over the hard limit and `--update` correctly refuses all of them.
 * Seeding is the one-time act of writing the backlog down, and it is the only mode that can record a
 * number ABOVE the limit that was not already recorded. Keeping it under its own flag means nobody
 * reaches for it to make a failing check go away, which is exactly how a ratchet becomes a high
 * water mark.
 */
if (process.argv.includes('--seed')) {
  const seeded: Record<string, number> = {};
  for (const [file, lines] of sizes) {
    if (lines > LIMIT && !file.startsWith('src/')) {
      seeded[file] = lines;
    }
  }
  writeFileSync(RATCHET_FILE, `${JSON.stringify(seeded, null, 2)}\n`);
  console.log(
    `Seeded a backlog of ${String(Object.keys(seeded).length)} file(s) over ${String(LIMIT)}.`
  );
  process.exit(0);
}

if (process.argv.includes('--update')) {
  const problems = findProblems(sizes, ratchet);
  if (problems.length > 0) {
    console.error('Refusing to update: fix these first, a ratchet records reductions only.\n');
    for (const problem of problems) {
      console.error(`  ${problem.file}: ${String(problem.lines)} lines, ${problem.reason}`);
    }
    process.exit(1);
  }
  const next = tightened(sizes, ratchet);
  writeFileSync(RATCHET_FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Recorded ${String(Object.keys(next).length)} file(s) still over ${String(LIMIT)}.`);
  process.exit(0);
}

const problems = findProblems(sizes, ratchet);
if (problems.length > 0) {
  console.error(`${String(problems.length)} file(s) over their ceiling:\n`);
  for (const problem of problems) {
    console.error(
      `  ${problem.file}: ${String(problem.lines)} lines, ceiling ${String(problem.ceiling)}, ${problem.reason}`
    );
  }
  console.error('\nExtract a responsibility into its own file. Do not trim to fit.');
  process.exit(1);
}

const backlog = Object.keys(ratchet).length;
console.log(
  `All ${String(sizes.size)} files within their ceiling. src/ is clear; ${String(backlog)} test and harness file(s) still over ${String(LIMIT)}.`
);
