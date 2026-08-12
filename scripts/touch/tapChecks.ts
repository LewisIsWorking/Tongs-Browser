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
import { MODULE_ID, type BoardBox } from '../foundry-session.ts';
import { LONG_PRESS_MS, pointerPosition } from './support.ts';
import { Finger } from '../foundry-touch.ts';
import { type Recorder } from '../live/recorder.ts';

/**
 * A tap and a long press act WHERE THE POINTER IS, not where the finger landed. Extracted from
 * foundry-touch-check 2026-08-12.
 *
 * ⚠️ This is the whole premise of the module, and the two checks are a pair for that reason. A tap
 * that clicks under the finger is indistinguishable from a working virtual pointer in every other
 * measurement here: the pointer still moves, the gesture is still recognised, and only the position
 * of the resulting click says which of the two happened.
 */

/**
 * The single most important behavioural claim in the module, and the one a user notices instantly.
 *
 * MANUAL-TESTING puts it this way: "Tap clicks at the pointer, not where your finger landed. If it
 * clicks under your finger, something is wrong."
 *
 * So the pointer is parked on a sidebar tab, and the tap happens far away over the canvas. If the tab
 * changes, the click went to the pointer. If it does not, the click went to the finger, and the whole
 * trackpad model is broken. Judged by Foundry's own tab state.
 */
export async function checkTapClicksAtPointerNotFinger(
  page: Page,
  finger: Finger,
  board: BoardBox,
  recorder: Recorder
): Promise<void> {
  const before = await page.evaluate(() => ui.sidebar.tabGroups.primary);
  const target = before === 'combat' ? 'chat' : 'combat';

  const parked = await page.evaluate(
    ({ id, tab }) => {
      const button = document.querySelector(`button[data-tab="${tab}"]`);
      if (button === null) {
        return null;
      }
      const box = button.getBoundingClientRect();
      const centre = { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
      game.modules.get(id).api.getPointer().moveTo(centre);
      return centre;
    },
    { id: MODULE_ID, tab: target }
  );

  if (parked === null) {
    recorder.record(
      'tap clicks at the pointer, not the finger',
      false,
      `no sidebar button for '${target}'`
    );
    return;
  }

  // Deliberately nowhere near the parked pointer, and over the canvas rather than over the chrome.
  const fingerX = board.x + board.width * 0.25;
  const fingerY = board.y + board.height * 0.75;
  await finger.down(fingerX, fingerY);
  await finger.up();

  const after = await page
    .waitForFunction((tab) => ui.sidebar.tabGroups.primary === tab, target, { timeout: 5000 })
    .then(() => target)
    .catch(async () => page.evaluate(() => ui.sidebar.tabGroups.primary));

  recorder.record(
    'tap clicks at the pointer, not the finger',
    after === target,
    `pointer parked at (${parked.clientX.toFixed(0)}, ${parked.clientY.toFixed(0)}), ` +
      `finger tapped (${fingerX.toFixed(0)}, ${fingerY.toFixed(0)}), tab ${before} -> ${after}`
  );
}

/**
 * A held finger becomes a right click at the pointer.
 *
 * Judged by listening for the contextmenu event rather than by looking for a Foundry menu, and that
 * limit is deliberate: an empty canvas has no token to open a HUD for, so a menu appearing is not
 * available as evidence here. What this does prove is that the long press timer fires under real
 * event timing, which no unit test with an injected clock can show.
 */
export async function checkLongPressRightClicks(
  page: Page,
  finger: Finger,
  board: BoardBox,
  recorder: Recorder
): Promise<void> {
  await page.evaluate(() => {
    globalThis.__probeContextMenus = [];
    document.addEventListener(
      'contextmenu',
      (event) => {
        globalThis.__probeContextMenus.push({ x: event.clientX, y: event.clientY });
        event.preventDefault();
      },
      { capture: true }
    );
  });

  const parked = await pointerPosition(page);

  await finger.down(board.x + board.width * 0.5, board.y + board.height * 0.5);
  await new Promise((resolve) => setTimeout(resolve, LONG_PRESS_MS + 300));
  await finger.up();

  const seen = await page.evaluate(() => globalThis.__probeContextMenus);
  const atPointer = seen.some(
    (point) => Math.abs(point.x - parked.x) < 2 && Math.abs(point.y - parked.y) < 2
  );

  recorder.record(
    'long press produces a right click at the pointer',
    seen.length > 0 && atPointer,
    `${seen.length} contextmenu event(s) ${JSON.stringify(seen)}, pointer at ` +
      `(${parked.x.toFixed(0)}, ${parked.y.toFixed(0)})`
  );
}
