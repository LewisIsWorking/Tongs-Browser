#!/usr/bin/env node
/**
 * Do the sheet-creation buttons work in a real Foundry. Added 2026-09-03.
 *
 * Run: npm run check:sheets      (a Foundry must be running with a world launched)
 *
 * ⚠️ WHY a browser at all, when 1414 unit tests pass. Because every one of these failures compiles,
 * type-checks and passes them:
 *
 *   - a button in the tray list that a gate filters out because it reads a global wrongly
 *   - a picker appended to a host that does not exist on a real page
 *   - a flow that throws inside a click handler, into a console a phone user cannot open
 *   - a notice whose text is right in the fixture and never reaches the DOM
 *
 * ⚠️ It does NOT exercise the party path, and says so rather than implying otherwise. `party` is a
 * PF2e actor type; the world here runs `coo`, so there is no party to open and none to create in.
 * What is left still matters, because "no parties yet" is the state every real user meets first.
 *
 * ✅ RUN 2026-09-03 against a live Foundry 14.366, world `cootestworld`: 5 of 5 passed. Both buttons
 * present for a GM, both pickers reachable, both notices correct, no module errors.
 * PROVEN it can fail, same run: an expected string changed to one nothing says produced
 * `FAIL ... expected "A MESSAGE NOTHING SAYS"` and exit 1.
 *
 * ⚠️ It writes NOTHING to the world. Unlike the other live harnesses there is no probe scene and no
 * probe actor, because everything asserted is about the tray and its notices.
 */
import {
  MODULE_ID,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  requireActiveWorld,
} from './foundry-session.ts';
import { createRecorder, describeOutcome, isFailure } from './live/recorder.ts';
import { checkButtonsPresent, watchModuleErrors } from './sheets/sheetChecks.ts';
import { checkPress, readWorld } from './sheets/partyChecks.ts';

const status = await requireActiveWorld();
const { browser, page } = await launchBrowser({ hasTouch: true });
const recorder = createRecorder();
const { record, results } = recorder;
const watcher = watchModuleErrors(page);

try {
  await joinWorld(page);
  await ensureModuleEnabled(page);

  await page.evaluate((id: string) => {
    const api = game.modules.get(id).api;
    if (!api.isEnabled()) {
      api.enable();
    }
  }, MODULE_ID);
  await page.waitForTimeout(800);

  await checkButtonsPresent(page, recorder);

  /*
   * ⚠️ The two notices say DIFFERENT things, and asserting both is the point. "There is no party" and
   * "you may not create here" are the pair this feature is most likely to confuse, and a check that
   * only asked "did a notice appear" would pass with either one in either place.
   */
  const world = await readWorld(page);
  console.error(
    `world holds ${String(world.parties)} party actor(s) and ${String(world.assignable)} user(s)` +
      `${world.names.length > 0 ? `: ${world.names.join(', ')}` : ''}`
  );

  await checkPress(page, recorder, 'create-sheet', world, 'the create button');
  await checkPress(page, recorder, 'party-access', world, 'the party access button');

  record(
    'no module error while the buttons were being used',
    watcher.errors.length === 0,
    watcher.errors.length === 0 ? 'console clean of module errors' : watcher.errors.join(' | ')
  );
} finally {
  await browser.close();
}

console.log(JSON.stringify({ target: status.world, core: status.version, results }, null, 2));
for (const result of results) {
  console.error(`${describeOutcome(result)}  ${result.name}: ${result.detail}`);
}
/*
 * ⛔ MEASURED, not asserted. Until 2026-09-10 this note was an unconditional string claiming the
 * party path was not covered, and it named `status.world` while calling it what the world "runs".
 * Those are two different fields: `/api/status` returns BOTH `world` (the world's id) and `system`
 * (the game system). Against a real PF2e world it printed "it needs a PF2e-family world; this one
 * runs 'tongs-pf2e'", which is the world id, and is a PF2e world.
 *
 * ⚠️ A DISCLAIMER THAT CANNOT CHANGE ITS MIND READS AS A MEASUREMENT. Nothing here would ever have
 * reported the party path as covered, however many parties the world held, so the gap could not
 * close on its own and nobody reading the output would know it had.
 */
const PF2E_FAMILY = ['pf2e', 'sf2e'];
const system = String(status.system ?? '');
console.error(
  PF2E_FAMILY.includes(system)
    ? `\nNOTE: system '${system}' is PF2e-family, so the party path above is real coverage.`
    : `\nNOTE: the party path is NOT covered here. It needs a PF2e-family world; this world's ` +
        `system is '${system}', where 'party' is not an actor type.`
);

const failed = results.filter(isFailure);
if (failed.length > 0) {
  console.error(`\n${String(failed.length)} of ${String(results.length)} sheet checks failed.`);
  process.exitCode = 1;
}
