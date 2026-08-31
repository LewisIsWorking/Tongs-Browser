#!/usr/bin/env node
/**
 * Shared test fixtures must actually be shared. Added 2026-08-13.
 *
 * ⚠️ THE FAILURE THIS EXISTS FOR, which has now happened twice in this repo:
 *
 * 1. `PixiMoveProbe` was extracted from the composition root, covered by its own tests, and never
 *    wired in. The root kept its own duplicate of the same counter, and only one of the two copies
 *    had tests. Recorded in the docblock of `DragObservers.attachPixiProbe`.
 * 2. `tests/dom/support/diagnosticsSnapshot.ts` was extracted "when the report tests were split and
 *    both halves needed it", and then both halves kept their own hand copy anyway. One fixture in
 *    three places, so a field added to the snapshot had to be added three times by hand - which came
 *    due when `tokenMovement` changed shape and every copy needed the identical edit.
 *
 * An extraction is not finished when the new file exists. It is finished when nothing else does the
 * job. `check:sizes` measures the first half of that, because a file over the limit is a number you
 * can see; nothing measured the second, because a duplicate that nobody imports looks exactly like
 * code that is simply not needed yet.
 *
 * COVERS: a module under a `support/` directory that no test imports.
 * MISSES: a copy that lives inside a test file rather than in `support/`, which is what actually
 *   happened. This catches the ORPHAN, not the duplicate; it fires the moment somebody extracts a
 *   fixture and forgets to adopt it, which is the step before the duplicate exists.
 *
 * Run: npm run check:support
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { listSourceFiles } from './sizes/listing.ts';

/*
 * ⚠️ The SAME listing every other guard uses, which includes UNTRACKED files. Changed 2026-08-30
 * after an audit: this guard still called `git ls-files`, which reports tracked files only, so a
 * fixture written moments ago was invisible until staged.
 *
 * That is precisely the case this guard exists for. An extraction is finished when nothing else does
 * the job, and the moment somebody is most likely to extract a fixture and forget to adopt it is the
 * moment they have just written it. Demonstrated before fixing: an unadopted `zzOrphan.ts` sitting in
 * `tests/dom/support/` produced "All 9 shared test fixture(s) are imported somewhere".
 *
 * The untracked blind spot was found in `check:sizes` on 2026-08-18 and fixed in two guards. This one
 * was missed, which is the lesson repeating: when a technique is shared, audit EVERY user of it, not
 * the ones that happen to be in front of you.
 */
const tracked = listSourceFiles().filter((file) => file.startsWith('tests/'));

const supportModules = tracked.filter((file) => file.includes('/support/'));
const consumers = tracked.filter((file) => !file.includes('/support/'));

/*
 * Matched on the BASENAME, because every import of these is relative and the prefix varies with the
 * importer's depth. A basename is enough to be useful and cannot produce the false PASS that a
 * stricter path match would, where a correct import written from an unexpected directory reads as
 * no import at all.
 */
const importedNames = new Set<string>();
for (const file of consumers) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
    const specifier = match[1];
    if (specifier !== undefined && specifier.includes('support/')) {
      importedNames.add(basename(specifier).replace(/\.js$/, '.ts'));
    }
  }
}

const orphans = supportModules.filter((file) => !importedNames.has(basename(file)));

if (orphans.length > 0) {
  console.error(`${String(orphans.length)} shared fixture(s) that nothing imports:\n`);
  for (const orphan of orphans) {
    console.error(`  ${orphan}`);
  }
  console.error(
    '\nAn extraction is finished when nothing else does the job, not when the file exists.'
  );
  console.error('Adopt it in the tests that need it, or delete it.');
  process.exit(1);
}

console.log(`All ${String(supportModules.length)} shared test fixture(s) are imported somewhere.`);
