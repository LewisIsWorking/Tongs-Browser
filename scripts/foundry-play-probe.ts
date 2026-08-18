/**
 * Can the virtual pointer actually PLAY the game? Written 2026-08-10, split up 2026-08-18.
 *
 * The other checks answer "did the event arrive" and "did Foundry's state change". This one answers
 * a blunter question: can someone holding only this pointer select a token, open a sheet, drag a
 * figure across the map, open the HUD, zoom, and roll dice.
 *
 * ⚠️ THE FIRST TWO VERSIONS OF THIS FILE WERE WRONG, in the same direction both times: they reported
 *    confident capability gaps that did not exist. Every single failure they found survived isolation
 *    intact. The module was fine and the instrument was not. What was wrong, and what is done now:
 *
 *    1. The control ran only AFTER the subject had failed, from whatever state that failure left
 *       behind. A control that runs second is a sequel, not a control. Now both paths run from the
 *       same freshly built state.
 *    2. One trial was reported as fact. Now every path runs three times and the trials are printed,
 *       because a capability that works once and not again is FLAKY, which is its own finding.
 *    3. ⭐ Worst and last found: all seven capabilities shared ONE actor, ONE token and one
 *       accumulating world, running in sequence, so each case inherited the wreckage of the last.
 *       Now every trial builds its own actor and token and deletes them again. A probe that reuses a
 *       fixture across cases measures history, not behaviour.
 *    4. The aim is asserted as its own precondition. If the pointer did not land inside the target,
 *       the trial reports AIM rather than a behaviour failure, because "the feature is broken" and
 *       "the feature was never reached" are different findings.
 *
 * ⚠️ WRITES TO A LIVE WORLD: a `[probe]` scene if there is none, plus a `[probe]` actor and token per
 *    trial. All removed as it goes, and the scene in the finally.
 *
 * ⚠️ THE BODY OF THIS PROBE RUNS IN THE PAGE, and is installed rather than imported. `page.evaluate`
 *    serialises its callback, so nothing it calls can be an import - which is why this was one 572
 *    line function for months. `page.addInitScript` serialises the same way but installs onto
 *    `window` before the page's scripts run and survives the navigations that joining performs, so
 *    the pieces can be separate modules that meet at one namespace. See probe/PlayRuntime.ts.
 */
import {
  BASE,
  ensureActiveScene,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  removeProbeScene,
  requireActiveWorld,
} from './foundry-session.ts';
import { installCanvasChecks } from './probe/PlayCanvasChecks.ts';
import { installCreateActorCheck } from './probe/PlayCreateActorCheck.ts';
import { installPlayEvents } from './probe/PlayEvents.ts';
import { installPlayFixture } from './probe/PlayFixture.ts';
import { installPlayKit } from './probe/PlayKit.ts';
import { PLAY_GLOBAL, type PlayWindow } from './probe/PlayRuntime.ts';
import { installSidebarChecks } from './probe/PlaySidebarChecks.ts';
import { reportCapabilities } from './probe/Report.ts';
import type { CapabilityRow } from './probe/Trials.ts';

const TRIALS = Number(process.env.PROBE_TRIALS ?? '3');

const status = await requireActiveWorld();
const { browser, page } = await launchBrowser({ hasTouch: true });
let scene = null;

try {
  /*
   * ⚠️ Installed BEFORE joining, because addInitScript applies to future navigations rather than the
   * current document. Joining navigates to /game and enabling the module reloads, so an install
   * afterwards would land on a page that is about to be replaced and the namespace would be gone by
   * the time it was needed.
   */
  await installPlayEvents(page);
  await installPlayFixture(page);
  await installPlayKit(page);
  await installCanvasChecks(page);
  await installCreateActorCheck(page);
  await installSidebarChecks(page);

  await joinWorld(page);
  await ensureModuleEnabled(page);
  scene = await ensureActiveScene(page, { width: 3000, height: 3000, label: 'play probe' });

  const rows: CapabilityRow[] = await page.evaluate(
    async ([globalName, trials]) => {
      const namespace = (window as PlayWindow)[globalName as '__tongsPlay'];
      if (namespace?.makeKit === undefined) {
        throw new Error(
          `the probe toolkit is not on window.${globalName}, so addInitScript did not survive to this page.`
        );
      }
      const kit = namespace.makeKit(Number(trials));
      await namespace.canvasChecks?.(kit);
      await namespace.createActorCheck?.(kit);
      await namespace.sidebarChecks?.(kit);
      return kit.results;
    },
    [PLAY_GLOBAL, String(TRIALS)] as const
  );

  console.log(
    JSON.stringify(
      { target: BASE, world: status.world, core: status.version, trials: TRIALS, rows },
      null,
      2
    )
  );

  reportCapabilities(rows, TRIALS);
} finally {
  await removeProbeScene(page, scene);
  await browser.close();
}
