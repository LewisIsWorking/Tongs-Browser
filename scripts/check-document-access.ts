#!/usr/bin/env node
/**
 * Every document listing goes through one boundary. Added 2026-09-01.
 *
 * ⚠️ COVERS: `src/` reaching into `game.actors`, `game.folders`, `game.users` and the rest anywhere
 *   except the one module allowed to, so the permission filter is written once.
 * ⚠️ MISSES: a listing obtained some other way entirely - a hook payload, a socket message, or a
 *   document handed in by Foundry. Those cannot be spotted by shape, and the boundary module's own
 *   tests are what cover them.
 * ANCHORED: audited 2026-09-01 before the sheet-creation pickers existed. `src/` enumerated NOTHING,
 *   so the rule "never show what the user may not see" held because there was no listing to get
 *   wrong. The pickers are the first listing this module has ever had.
 * PROVEN: `--self-test` feeds it a real enumeration, the allowed `activeGM` lookup, and a comment
 *   mentioning the pattern, and `npm run check:documents` RUNS it before the real check.
 *
 * Run: npm run check:documents
 */
import { readFileSync } from 'node:fs';

import { findDocumentAccess, selfTest } from './documents/rules.ts';
import { listSourceFiles } from './sizes/listing.ts';

if (process.argv.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

/**
 * The modules allowed to enumerate, each of which must filter by permission immediately.
 *
 * ⚠️ `FoundryActions` was found by this guard on its first run, and a hand grep had missed it: the
 * pattern `game.actors` cannot match `game?.actors`, because the unescaped dot matches exactly one
 * character. The audit that preceded this guard therefore reported "the module enumerates nothing",
 * which was wrong.
 *
 * It is listed rather than fixed because it is already correct, and correct in the shape every future
 * listing should copy. `openCharacterSheet` reads `game.actors` and hands it straight to
 * `resolveCharacterSheet`, which keeps only `isOwner === true` and opens a sheet only when exactly
 * one survives. No name is ever displayed, and the one actor it can open is one the user owns.
 *
 * The obligation that comes with being on this list: enumerate, filter by permission in the same
 * breath, and never render an unfiltered result.
 */
const BOUNDARY: readonly string[] = [
  'src/foundry/FoundryActions.ts',
  /*
   * ⚠️ Added 2026-09-02 with the party pickers. It is the boundary this guard was written FOR, ahead
   * of it existing. It filters parties to those the viewer has at least LIMITED on, fails closed when
   * a document cannot answer, and hands the result to `PartyRoster` for the authorisation rules.
   */
  'src/foundry/PartyAccess.ts',
];

const sources = listSourceFiles().filter(
  (file) => file.startsWith('src/') && file.endsWith('.ts') && !file.endsWith('.d.ts')
);

const offenders = sources
  .filter((file) => !BOUNDARY.includes(file))
  .flatMap((file) => findDocumentAccess(readFileSync(file, 'utf8'), file));

if (offenders.length > 0) {
  console.error(`${String(offenders.length)} document listing(s) outside the boundary:\n`);
  for (const offender of offenders) {
    console.error(`  ${offender.file}:${String(offender.line)}  ${offender.what}`);
    console.error(`    ${offender.text}`);
  }
  console.error(
    '\nA player must never be shown a sheet, party or folder they cannot see. Filter once, behind\n' +
      'one boundary, rather than at each call site: a rule applied in N places is eventually a rule\n' +
      'applied in N-1. Add the boundary module to BOUNDARY in this file if that is what this is.'
  );
  process.exit(1);
}

console.log(
  `No document listings outside the boundary, across ${String(sources.length)} source file(s).`
);
