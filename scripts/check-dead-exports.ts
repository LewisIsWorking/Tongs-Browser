#!/usr/bin/env node
/**
 * Exported values that nothing uses. Added 2026-08-19.
 *
 * ⚠️ Coverage was the only thing pointing at these, and coverage answers the wrong question. Three
 * files in a row were opened because they were poorly covered, and each time the uncovered part was
 * an exported value nothing called. A sweep found ten; deleting one made a second dead by cascade,
 * which the typechecker caught. "Untested" and "unreachable" need different work.
 *
 * `check:support` asks this of shared test fixtures. This asks it of production code.
 *
 * ⚠️ Flags go through `node`, not `npm run ... --`: npm 12 parses unknown flags itself.
 *
 * Run: npm run check:exports
 *      node scripts/check-dead-exports.ts --self-test
 */
import { readFileSync } from 'node:fs';

import { describeDeadExport, findDeadExports, selfTest } from './exports/rules.ts';
import { listSourceFiles } from './sizes/listing.ts';

if (process.argv.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

const all = listSourceFiles();
const corpus = new Map(all.map((file) => [file, readFileSync(file, 'utf8')]));
/*
 * Only `src/` is judged. A script or a test may export a helper for a reader's benefit, and holding
 * throwaway harness code to the same rule would be noise rather than signal.
 */
const sources = new Map([...corpus].filter(([file]) => file.startsWith('src/')));

const dead = findDeadExports(sources, corpus);
if (dead.length > 0) {
  console.error(`${String(dead.length)} exported value(s) nothing uses:\n`);
  for (const one of dead) {
    console.error(`  ${describeDeadExport(one)}`);
  }
  console.error(
    '\nAn export nothing imports is a promise to a caller that does not exist.' +
      '\nDelete it, or drop the export if the file still needs it.'
  );
  process.exit(1);
}

console.log(`No dead exports across ${String(sources.size)} source file(s).`);
