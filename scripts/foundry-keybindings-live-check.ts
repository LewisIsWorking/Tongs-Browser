#!/usr/bin/env node
/**
 * Does the keybinding snapshot still match the Foundry that is installed. Added 2026-09-10.
 *
 * Run: npm run check:keybindings:live      (a Foundry must be running with a world launched)
 *
 * ⛔ WHY THIS EXISTS, and it is worth reading before changing it. `check:keybindings` compares the
 * ROUTING TABLE against the SNAPSHOT. Both are written by us, so the strongest thing it can prove is
 * that we agree with ourselves. On 2026-09-10 it printed
 *
 *     OK: all 37 core keybinding(s) from Foundry 14.366 are accounted for.
 *
 * on a machine running 14.367, where four bindings were unaccounted for and `KeyE` had moved from
 * `moveDownRight` to a brand new `ascend`. Nothing in that line was false, and nothing in it was
 * useful either.
 *
 * ⚠️ The snapshot's freshness was, until this script, enforced by a sentence in
 * `docs/MANUAL-TESTING.md` asking a human to re-take it on a version bump. The gap that left was
 * invisible exactly because the guard beside it was green.
 *
 * ⚠️ SEPARATE from the CI guard on purpose. That one has to run where no Foundry exists. This one
 * fails when it cannot find a Foundry, because a freshness check that skips proves nothing.
 */
import { ensureInGame, joinWorld, launchBrowser, requireActiveWorld } from './foundry-session.ts';
import { compareToLive, describeVersions } from './keybindings/freshness.ts';
import { CORE_BINDINGS, FOUNDRY_VERSION, type FoundryBinding } from './keybindings/snapshot.ts';

const status = await requireActiveWorld();
const { browser, page } = await launchBrowser({ hasTouch: false });

let live: FoundryBinding[];
try {
  await joinWorld(page);
  await ensureInGame(page);

  /*
   * ⚠️ `game.keybindings.actions` is the REGISTRATION, keyed `namespace.action`, already validated
   * by Foundry itself. Reading it beats parsing the source file: it survives a refactor of that
   * file, and it reflects what this install registered rather than what the shipped source would.
   *
   * ⛔ BOTH `uneditable` AND `editable`, and reading only one of them is a bug this check made on
   * its first run. Foundry puts the fixed bindings in `uneditable` and the rebindable ones in
   * `editable`, and some bindings have BOTH: `delete` is `Delete` uneditable plus `Backspace`
   * editable. Reading `editable` alone reported Escape, Ctrl+A, Ctrl+Z, Ctrl+X, Ctrl+C and Ctrl+V
   * as "(unbound)" and `delete` as having moved to Backspace, which is six false alarms and one
   * misleading one on a Foundry that had not changed at all.
   *
   * ⚠️ MODIFIERS ARE PART OF THE BINDING, formatted here the way the snapshot writes them
   * (`CONTROL+KeyA`). Comparing bare keys would call Ctrl+C and plain C the same binding, which is
   * precisely the confusion the map-building work turned on.
   */
  live = await page.evaluate(() => {
    interface Bound {
      key?: string;
      modifiers?: string[];
    }
    const actions = (
      globalThis as unknown as {
        game?: {
          keybindings?: { actions?: Map<string, { editable?: Bound[]; uneditable?: Bound[] }> };
        };
      }
    ).game?.keybindings?.actions;
    if (actions === undefined) {
      return [];
    }
    const format = (bound: Bound): string =>
      [
        ...(bound.modifiers ?? []).map((modifier) => String(modifier).toUpperCase()),
        String(bound.key ?? ''),
      ].join('+');

    return [...actions.entries()]
      .filter(([id]) => id.startsWith('core.'))
      .map(([id, data]) => ({
        name: id.slice('core.'.length),
        keys: [...(data.uneditable ?? []), ...(data.editable ?? [])].map(format),
      }));
  });
} finally {
  await browser.close();
}

if (live.length === 0) {
  console.error('Read no core keybindings from the running Foundry, so nothing could be compared.');
  console.error('That is a failure of this check, not a clean result.');
  process.exit(1);
}

console.error(describeVersions(FOUNDRY_VERSION, String(status.version ?? '')));
console.error(
  `snapshot holds ${String(CORE_BINDINGS.length)} binding(s); this Foundry registers ${String(live.length)}`
);

const problems = compareToLive(CORE_BINDINGS, live);
if (problems.length > 0) {
  console.error(`\n${String(problems.length)} snapshot freshness problem(s):\n`);
  for (const problem of problems) {
    console.error(`  ${problem.binding} ${problem.reason}`);
  }
  console.error(
    '\nRe-take the snapshot in scripts/keybindings/snapshot.ts from this Foundry, then give every\n' +
      'new binding a route in scripts/keybindings/coverage.ts. A key that has CHANGED HANDS needs the\n' +
      'route re-read rather than the name kept: the decision under it was made about a different\n' +
      'capability.'
  );
  process.exit(1);
}

console.log(
  `OK: the snapshot matches this Foundry exactly, ${String(live.length)} core keybinding(s).`
);
