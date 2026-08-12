#!/usr/bin/env node
/**
 * Two finger pan and pinch, against a real Foundry canvas. Added 2026-08-09.
 *
 * Run: npm run check:multitouch     (a Foundry must be running with a world launched)
 *
 * ADR 0006 covered single finger touch and named multi touch as the remaining gap. Closing it found
 * a real bug on the first attempt, which is recorded in ADR 0007: the pinch was building on a
 * remembered scale of 1 rather than on the scale the canvas was actually at, so the first pinch of
 * every session lurched by a factor of 1/initialScale.
 *
 * That is why the pinch assertion here is a RATIO between the scale before and after, compared
 * against the ratio the fingers moved. An assertion against an absolute scale would have passed
 * happily while the canvas jumped, because the number it jumped to was itself perfectly predictable.
 *
 * ⚠️ WRITES TO A LIVE WORLD: creates a `[probe]` scene when there is no active one, deletes it in a
 *    finally.
 */
import type { Page } from 'playwright';
import {
  BASE,
  boardCentre,
  captureModuleLog,
  ensureActiveScene,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  removeProbeScene,
  requireActiveWorld,
  type ClientPoint,
} from './foundry-session.ts';
import { viewport } from './touch/support.ts';
import { checkPinchIsRelative, checkPinchIsReversible } from './touch/pinchChecks.ts';
import { createRecorder, describeOutcome, isFailure, type Recorder } from './live/recorder.ts';
import { Hand } from './foundry-touch.ts';

/**
 * Two fingers moving together pan the canvas, and the map moves WITH the fingers.
 *
 * Foundry's pivot is the point the viewport is centred on, so dragging the map right means the pivot
 * moves left. Asserted as a sign rather than a magnitude, because the pixel to scene conversion
 * depends on the current zoom and pinning it would test the arithmetic rather than the behaviour.
 */
async function checkTwoFingerPan(
  page: Page,
  hand: Hand,
  centre: ClientPoint,
  recorder: Recorder
): Promise<void> {
  const before = await viewport(page);

  const gap = 80;
  const start = [
    { x: centre.x - gap, y: centre.y },
    { x: centre.x + gap, y: centre.y },
  ];
  await hand.start(start);
  for (let step = 1; step <= 6; step += 1) {
    const shift = (120 * step) / 6;
    await hand.move(start.map((point) => ({ x: point.x + shift, y: point.y + shift })));
  }
  await hand.end();

  const after = await viewport(page);
  const movedX = after.pivot.x - before.pivot.x;
  const movedY = after.pivot.y - before.pivot.y;

  /*
   * ⚠️ This used to assert ONLY the sign, and stayed green through a real bug for a year of nothing.
   *
   * panBy passed its screen delta straight into canvas.pan, which is ABSOLUTE, so a +120,+120 drag
   * set the pivot to roughly (-120, -120) rather than moving it by 120. On a 4000x3000 scene that
   * measured as the pivot "moving" (-1940, -980): negative on both axes, exactly as demanded, and
   * completely wrong.
   *
   * Now asserts the MAGNITUDE against what the geometry requires. The fingers moved 120 screen
   * pixels, so the pivot must move 120/scale scene units in the opposite direction. The band is
   * generous because the gesture has a movement threshold before it engages, but it is nowhere near
   * wide enough to admit a teleport.
   */
  const expected = 120 / before.scale;
  const withinBand = (moved: number): boolean => {
    const ratio = Math.abs(moved) / expected;
    return ratio > 0.5 && ratio < 1.5;
  };

  recorder.record(
    'two finger drag pans the canvas, map following the fingers',
    movedX < 0 && movedY < 0 && withinBand(movedX) && withinBand(movedY),
    `fingers moved +120,+120 at scale ${before.scale.toFixed(3)}, so the pivot should move about ` +
      `-${expected.toFixed(0)} on each axis. It moved (${movedX.toFixed(0)}, ${movedY.toFixed(0)})`
  );

  recorder.record(
    'panning does not change the zoom',
    Math.abs(after.scale - before.scale) < 1e-6,
    `scale ${before.scale} -> ${after.scale}`
  );
}

async function main() {
  const recorder = createRecorder();
  const { record, results } = recorder;
  const status = await requireActiveWorld();
  const { browser, page } = await launchBrowser({ hasTouch: true });
  const log = captureModuleLog(page);
  let createdScene = null;

  try {
    await joinWorld(page);
    await ensureModuleEnabled(page);
    // 4000 deliberately: larger than the viewport, so Foundry fits it and the canvas does NOT start
    // at 1. A scene that happened to load at 1 would hide the very bug this file exists to guard.
    createdScene = await ensureActiveScene(page, {
      width: 4000,
      height: 4000,
      label: 'multitouch check',
    });

    const client = await page.context().newCDPSession(page);
    const hand = new Hand(client);

    const start = await viewport(page);
    record(
      'the scene does not start at 1x, so a relative pinch is measurable',
      Math.abs(start.scale - 1) > 0.01,
      `canvas loaded at ${start.scale}`
    );

    const board = await boardCentre(page);

    await checkTwoFingerPan(page, hand, board, recorder);
    const afterPinch = await checkPinchIsRelative(page, hand, board, recorder);
    await checkPinchIsReversible(
      page,
      hand,
      board,
      { scale: afterPinch.scale / (160 / 100) },
      recorder
    );

    const errors = log.filter((line) => line.startsWith('pageerror') || line.startsWith('error'));
    record('no page errors from the module', errors.length === 0, errors.join(' | ') || 'none');
  } finally {
    await removeProbeScene(page, createdScene);
    await browser.close();
  }

  console.log(
    JSON.stringify(
      { target: BASE, world: status.world, core: status.version, results, log },
      null,
      2
    )
  );

  for (const result of results) {
    console.error(`${describeOutcome(result)}  ${result.name}: ${result.detail}`);
  }

  const failed = results.filter(isFailure);
  if (failed.length > 0) {
    console.error(`\n${failed.length} of ${results.length} multitouch checks failed.`);
    process.exitCode = 1;
  }
}

await main();
