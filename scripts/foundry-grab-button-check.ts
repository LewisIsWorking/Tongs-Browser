#!/usr/bin/env node
/**
 * Tapping the grab button with a FINGER, and watching what reaches the canvas. Added 2026-08-12.
 *
 * ⚠️ Every other drag harness here calls `api.getPointer().beginDrag()` from JavaScript, which
 * produces no DOM events whatsoever, and every one of them passes. A device does something none of
 * them do: it reaches that button with a finger. The user found the difference by experiment, not
 * from any report we produced: "dragging works when I have the hand off, then I turn the hand on
 * and it breaks".
 *
 * Run: npm run check:grab
 */
import {
  MODULE_ID,
  ensureActiveScene,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  removeProbeScene,
  requireActiveWorld,
} from './foundry-session.ts';
import { Finger } from './foundry-touch.ts';
import { checkGrabThenDrag, removeProbeToken } from './touch/grabDragCheck.ts';
import { createRecorder, describeOutcome, isFailure } from './live/recorder.ts';
import {
  clearArrived,
  grabButtonCentre,
  readArrived,
  watchWindowEvents,
} from './probe/GrabButtonProbe.ts';

const status = await requireActiveWorld();
const { browser, page } = await launchBrowser({ hasTouch: true });
const recorder = createRecorder();
const { record, skip, results } = recorder;
let createdScene = null;
let probeToken: { actorId: string; tokenId: string } | null = null;

try {
  await joinWorld(page);
  await ensureModuleEnabled(page);
  createdScene = await ensureActiveScene(page);

  await page.evaluate((id: string) => {
    const api = game.modules.get(id).api;
    if (!api.isEnabled()) {
      api.enable();
    }
  }, MODULE_ID);
  await page.waitForTimeout(600);

  const button = await grabButtonCentre(page);
  if (button === null) {
    /* ⚠️ SKIP: no button means nothing was measured, which says nothing about whether it misbehaves. */
    skip(
      'a finger tap on the grab button reaches only the bar',
      'no [data-action="grab"] on the bar'
    );
  } else {
    record(
      'the grab button is on the bar and reachable',
      true,
      `at (${button.x.toFixed(0)}, ${button.y.toFixed(0)}) labelled ${JSON.stringify(button.label)}`
    );

    await watchWindowEvents(page);
    await clearArrived(page);

    const client = await page.context().newCDPSession(page);
    const finger = new Finger(client);
    await finger.tap(button.x, button.y);
    await page.waitForTimeout(500);

    const arrived = await readArrived(page);

    /*
     * ⚠️ TRUSTED events only. The module synthesises its own pointer events and those are supposed
     * to be here; counting them would make this fail for the one reason that is not a bug.
     */
    /*
     * ⚠️ A CONTROL first, because the alternative is a probe that cannot fail. The finger tap MUST
     * produce a touchstart at the window; if it did not, this run measured nothing whatsoever and
     * the verdict below would be "no compatibility events" for the one reason that proves nothing.
     * The first version of this probe reported a confident PASS off zero observations.
     */
    const sawTheTouch = arrived.some((event) => event.type === 'touchstart' && event.trusted);
    if (!sawTheTouch) {
      skip(
        'a finger tap on the grab button leaks nothing to the window, where PIXI listens',
        `the probe recorded ${String(arrived.length)} event(s) and no native touchstart among them, ` +
          'so the tap never reached the window and nothing was measured'
      );
    }

    const native = arrived.filter((event) => event.trusted);
    /*
     * ⚠️ `pointerup` matters MORE than the compatibility mouse events, and the first version of this
     * probe watched only the latter. PIXI binds `pointerup` on the window in the capture phase and
     * maps it onto the canvas by COORDINATE, so a trusted touch pointerup on our own bar reaches
     * Foundry as a canvas pointerup. `#handlePointerUp` ends with `#handleDragCancel`.
     *
     * `click` is deliberately NOT counted. It is how the button works, PIXI does not listen for it,
     * and suppressing it would break the bar to fix the canvas.
     */
    const leaked = native.filter(
      (event) =>
        event.type === 'pointerdown' ||
        event.type === 'pointerup' ||
        event.type === 'mousedown' ||
        event.type === 'mouseup'
    );

    if (sawTheTouch)
      record(
        'a finger tap on the grab button leaks nothing to the window, where PIXI listens',
        leaked.length === 0,
        leaked.length === 0
          ? 'none, so nothing of ours can reach PIXI by coordinate'
          : `${String(leaked.length)}: ` +
              leaked
                .map(
                  (e) =>
                    `${e.type}@${String(Math.round(e.x))},${String(Math.round(e.y))} -> ${e.target}`
                )
                .join('; ')
      );

    console.error('\nEverything that reached the window during the tap:');
    for (const event of arrived) {
      console.error(
        `  ${event.trusted ? 'native ' : 'ours   '} ${event.type.padEnd(12)} ` +
          `${event.pointerType.padEnd(6)} @${String(Math.round(event.x))},${String(Math.round(event.y))} -> ${event.target}`
      );
    }

    /*
     * ⚠️ The USER'S actual sequence, end to end, and nothing else here covers it. `check:drag`
     * drives the pointer from JavaScript and `check:touch` never touches the bar, so the one path a
     * person actually takes, tap the grab button with a finger and then drag with a finger, had no
     * check at all. That is the path that failed on a device for five rounds.
     */
    ({ probeToken } = await checkGrabThenDrag(page, finger, button, recorder));
  }
} finally {
  if (probeToken !== null) {
    await removeProbeToken(page, probeToken);
  }
  await removeProbeScene(page, createdScene);
  await browser.close();
}

console.log(JSON.stringify({ target: status.world, core: status.version, results }, null, 2));
for (const result of results) {
  console.error(`${describeOutcome(result)}  ${result.name}: ${result.detail}`);
}

const failed = results.filter(isFailure);
if (failed.length > 0) {
  console.error(
    `\n${String(failed.length)} of ${String(results.length)} grab button checks failed.`
  );
  process.exitCode = 1;
}
