#!/usr/bin/env node
/**
 * Drive the module with REAL touch events, against a real Foundry. Added 2026-08-09.
 *
 * Run: npm run check:touch     (a Foundry must be running with a world launched)
 *
 * ADR 0005 measured that Foundry accepts the virtual pointer, but it drove `VirtualPointer` directly
 * through the module API. Everything upstream of that, `TouchBinder` and the gesture state machine,
 * had never seen a finger: the unit tests construct `TouchEvent` objects by hand, and jsdom has no
 * touch hardware at all.
 *
 * These touches are dispatched through Chrome DevTools Protocol, so they arrive with `isTrusted`
 * true, from the browser's own input pipeline, with the browser generating its own compatibility
 * pointer and mouse events alongside them exactly as a real tablet would. That last part matters as
 * much as the touches: suppressing those compatibility events is a real feature with a real failure
 * mode, and it cannot be exercised by any hand built event.
 *
 * ⚠️ WRITES TO A LIVE WORLD, same as the pointer check: creates a `[probe]` scene if the world has no
 *    active one, and deletes it in a finally.
 */
import type { Page } from 'playwright';
import {
  BASE,
  boardBox,
  captureModuleLog,
  ensureActiveScene,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  removeProbeScene,
  requireActiveWorld,
  type BoardBox,
} from './foundry-session.ts';
import { checkLongPressRightClicks, checkTapClicksAtPointerNotFinger } from './touch/tapChecks.ts';
import { pointerPosition } from './touch/support.ts';
import { checkChatLogIsExcluded, checkNativeTouchSuppressed } from './touch/suppressionChecks.ts';
import { Finger } from './foundry-touch.ts';
import { createRecorder, describeOutcome, isFailure, type Recorder } from './live/recorder.ts';

/** Matches SettingDefinitions. Asserted loosely, but the direction and rough size come from these. */
const SENSITIVITY = 1.5;

/**
 * One finger drag moves the pointer, by roughly the drag distance times sensitivity.
 *
 * Asserted as a ratio inside a generous band rather than an exact figure. The pointer clamps at the
 * viewport edge and the gesture machine has a small movement threshold before it starts, so an exact
 * equality here would be a test of arithmetic that would fail for reasons that are not bugs.
 */
async function checkDragMovesPointer(
  page: Page,
  finger: Finger,
  board: BoardBox,
  recorder: Recorder
): Promise<void> {
  const before = await pointerPosition(page);

  const deltaX = 200;
  const deltaY = 120;
  await finger.drag(board.x + board.width * 0.3, board.y + board.height * 0.5, deltaX, deltaY);

  const after = await pointerPosition(page);
  const movedX = after.x - before.x;
  const movedY = after.y - before.y;
  const ratioX = movedX / (deltaX * SENSITIVITY);

  recorder.record(
    'one finger drag moves the pointer',
    movedX > 0 && movedY > 0 && ratioX > 0.6 && ratioX < 1.2,
    `moved (${movedX.toFixed(0)}, ${movedY.toFixed(0)}) for a ${deltaX}x${deltaY} drag, ` +
      `x ratio ${ratioX.toFixed(2)} of the expected ${SENSITIVITY}x`
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
    createdScene = await ensureActiveScene(page);

    const touchable = await page.evaluate(() => 'ontouchstart' in window);
    record(
      'browser context reports touch support',
      touchable,
      `ontouchstart in window = ${touchable}`
    );

    const client = await page.context().newCDPSession(page);
    const finger = new Finger(client);

    const board = await boardBox(page);

    await checkDragMovesPointer(page, finger, board, recorder);
    await checkTapClicksAtPointerNotFinger(page, finger, board, recorder);
    await checkLongPressRightClicks(page, finger, board, recorder);
    await checkNativeTouchSuppressed(page, finger, board, recorder);
    await checkChatLogIsExcluded(page, finger, recorder);

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
    console.error(`\n${failed.length} of ${results.length} touch checks failed.`);
    process.exitCode = 1;
  }
}

await main();
