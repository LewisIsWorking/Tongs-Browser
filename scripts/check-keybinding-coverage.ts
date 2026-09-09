#!/usr/bin/env node
/**
 * Every Foundry keybinding is either reachable from a phone or written down as not. Added 2026-09-07.
 *
 * ⛔ WHAT IT ACTUALLY CATCHES, which is the only question worth asking of a guard:
 *
 *   1. Foundry adds a keybinding and nobody notices the capability is unreachable. This is how the
 *      target key went missing: the bar had eight keys, Foundry had thirty-seven, and nothing
 *      compared the two.
 *   2. A key or a tray button is removed and the coverage claim keeps saying it is there. A table
 *      that names a control nobody has to keep is a document that rots into a confident lie.
 *
 * ⚠️ Reads the module's own source as TEXT rather than importing it, matching `check-document-access`
 * and for the same reason: these are browser modules that expect a `document` and Foundry globals,
 * and a Node guard that has to stand a DOM up before it can count buttons is a guard nobody runs.
 *
 * ⚠️ It compares against a dated SNAPSHOT of Foundry's registrations, not a live install, so it runs
 * in CI where there is no Foundry. Re-take the snapshot on a version bump; the version it was taken
 * from is printed on every run so a stale one is visible rather than silent.
 */
import { readFileSync } from 'node:fs';

import { countByKind, findProblems, ROUTES } from './keybindings/coverage.ts';
import { barCodesFrom, trayIdsFrom } from './keybindings/parse.ts';
import { CORE_BINDINGS, FOUNDRY_VERSION } from './keybindings/snapshot.ts';

/**
 * Every file that declares tray buttons.
 *
 * ⛔ A LIST, because it stopped being one file on 2026-09-09 and the guard did not know. The GM
 * map-building cluster was extracted to its own module to keep `TrayActionList` under the size limit,
 * and this check kept reading only the original, so it reported six buttons that exist as missing.
 * That direction is the harmless one. The dangerous version of the same bug is a button file nobody
 * lists, whose ids are then unroutable and whose absence reads as "not built yet".
 *
 * ⚠️ ADD A FILE HERE when tray buttons are declared in a new module. The size rule guarantees that
 * keeps happening: a flat list of buttons grows until it must be split, and each split silently
 * narrows a text-scanning guard unless it is told.
 */
const TRAY_BUTTON_SOURCES: readonly string[] = [
  'src/ui/TrayActionList.ts',
  'src/ui/MapBuildingButtons.ts',
];

/**
 * ⚠️ Proves the guard on made up input before trusting it on the repo. A check whose only evidence
 * is "the repository passes" stops proving anything the moment the repository is clean.
 */
function selfTest(): number {
  const bindings = [{ name: 'invented', keys: ['KeyZ'] }];
  const unaccounted = findProblems(new Set(), new Set(), bindings, {});
  if (unaccounted.length !== 1) {
    console.error('SELF TEST FAILED: an unaccounted binding was not reported.');
    return 1;
  }

  const brokenBar = findProblems(new Set(), new Set(), bindings, {
    invented: { kind: 'bar', via: 'KeyZ' },
  });
  if (brokenBar.length !== 1) {
    console.error(
      'SELF TEST FAILED: a route naming a bar key that does not exist was not reported.'
    );
    return 1;
  }

  const brokenTray = findProblems(new Set(['KeyZ']), new Set(), bindings, {
    invented: { kind: 'tray', via: 'gone' },
  });
  if (brokenTray.length !== 1) {
    console.error(
      'SELF TEST FAILED: a route naming a tray button that does not exist was not reported.'
    );
    return 1;
  }

  const orphan = findProblems(new Set(['KeyZ']), new Set(), bindings, {
    invented: { kind: 'bar', via: 'KeyZ' },
    retired: { kind: 'gap', note: 'Foundry no longer has this.' },
  });
  if (orphan.length !== 1) {
    console.error(
      'SELF TEST FAILED: a route for a binding Foundry no longer registers was not reported.'
    );
    return 1;
  }

  const clean = findProblems(new Set(['KeyZ']), new Set(), bindings, {
    invented: { kind: 'bar', via: 'KeyZ' },
  });
  if (clean.length !== 0) {
    console.error('SELF TEST FAILED: a sound table was reported as a problem.');
    return 1;
  }

  console.log('Self test passed: unaccounted bindings, dead routes and orphans are all caught.');
  return 0;
}

/*
 * ⚠️ Top level, matching every other check here, and the self test falls THROUGH rather than calling
 * `process.exit(0)`. On Windows, exiting explicitly while stdout is still flushing aborted this
 * script with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` and an exit code of 127,
 * AFTER printing that the self test had passed. A guard that reports success and then returns
 * failure is worse than one that fails: it makes the gate look broken rather than the code.
 */
if (process.argv.includes('--self-test')) {
  const failed = selfTest();
  if (failed !== 0) {
    process.exit(failed);
  }
} else {
  const barCodes = barCodesFrom(readFileSync('src/modifiers/keyDefinitions.ts', 'utf8'));
  const trayIds = trayIdsFrom(
    TRAY_BUTTON_SOURCES.map((path) => readFileSync(path, 'utf8')).join('\n')
  );
  const problems = findProblems(barCodes, trayIds);

  if (problems.length > 0) {
    console.error(`${String(problems.length)} keybinding coverage problem(s):\n`);
    for (const problem of problems) {
      console.error(`  ${problem.binding} ${problem.reason}`);
    }
    console.error(
      '\nEvery keybinding Foundry registers must say how a phone reaches it, or say plainly that it\n' +
        'cannot and what that costs. Edit ROUTES in scripts/keybindings/coverage.ts. A capability that\n' +
        'is simply absent, with nothing written down, is the bug this check exists to prevent.'
    );
    process.exit(1);
  }

  const counts = countByKind();
  const gaps = Object.entries(ROUTES).filter(([, route]) => route.kind === 'gap');
  console.log(
    `OK: all ${String(CORE_BINDINGS.length)} core keybinding(s) from Foundry ${FOUNDRY_VERSION} are accounted for.`
  );
  console.log(
    `  ${String(counts['bar'] ?? 0)} on the modifier bar · ${String(counts['tray'] ?? 0)} on the control pad · ` +
      `${String(counts['ui'] ?? 0)} through Foundry's own on-screen UI · ${String(gaps.length)} not reachable.`
  );
  console.log(
    '  The unreachable ones are recorded with what each costs, rather than merely absent.'
  );
}
