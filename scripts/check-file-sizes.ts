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

import { LIMIT, countLines, findProblems, selfTest, tightened } from './sizes/ratchet.ts';

/** Where the backlog's ceilings live, one entry per file still over the limit. */
const RATCHET_FILE = 'scripts/file-size-ratchet.json';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

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

/*
 * ⚠️ `--raise=<file>` names ONE file, and that is the entire safeguard. A ratchet needs some way to
 * record a justified increase, or the first unsplittable file to gain a feature forces someone to
 * re-seed the whole list and every other ceiling silently resets to its current worst. Requiring the
 * path means the increase appears in the diff as a specific number against a specific file, next to
 * the commit that explains it, instead of vanishing into a bulk rewrite.
 *
 * It refuses `src/`, which has no backlog and is held at the hard limit.
 */
const raised = process.argv
  .filter((arg) => arg.startsWith('--raise='))
  .map((arg) => arg.slice('--raise='.length));

if (raised.length > 0) {
  for (const file of raised) {
    const lines = sizes.get(file);
    if (lines === undefined) {
      console.error(`No such tracked file: ${file}`);
      process.exit(1);
    }
    if (file.startsWith('src/')) {
      console.error(
        `Refusing to raise ${file}: src/ is held at ${String(LIMIT)} with no exceptions.`
      );
      process.exit(1);
    }
    ratchet[file] = lines;
    console.error(`Raised ${file} to ${String(lines)}.`);
  }
  writeFileSync(
    RATCHET_FILE,
    `${JSON.stringify(ratchet, null, 2)}
`
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
