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
import { type BoardBox } from '../foundry-session.ts';
import { pointerPosition } from './support.ts';
import { Finger } from '../foundry-touch.ts';
import { type Recorder } from '../live/recorder.ts';

/**
 * Whether a real finger's own pointer events stay away from Foundry, and whether the regions that
 * keep their native behaviour actually keep it. Extracted from foundry-touch-check 2026-08-12.
 *
 * These two belong together: both are about what the gesture layer must NOT do. The suppression is
 * what makes the virtual pointer usable at all, and the exclusion is what stops it eating the chat.
 */

/**
 * The browser's own touch derived pointer events must not reach Foundry.
 *
 * If they do, every gesture is seen twice: once as the module intends and once as the browser's
 * compatibility event, and Foundry acts on both. This is the failure that no hand built event can
 * reproduce, because only a genuine touch makes the browser emit the compatibility pair.
 *
 * Counted at the document in the BUBBLE phase, which is where Foundry's own listeners sit. The module
 * stops these in the capture phase, so anything counted here got past it.
 */
export async function checkNativeTouchSuppressed(
  page: Page,
  finger: Finger,
  board: BoardBox,
  recorder: Recorder
): Promise<void> {
  await page.evaluate((virtualId) => {
    globalThis.__probeLeaked = [];
    document.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch' && event.pointerId !== virtualId) {
        globalThis.__probeLeaked.push({ id: event.pointerId, type: event.pointerType });
      }
    });
  }, 9001);

  await finger.drag(board.x + board.width * 0.5, board.y + board.height * 0.5, 60, 40, 4);

  const leaked = await page.evaluate(() => globalThis.__probeLeaked);

  recorder.record(
    'native touch pointer events never reach foundry',
    leaked.length === 0,
    leaked.length === 0 ? 'none leaked past the capture phase' : JSON.stringify(leaked)
  );
}

/**
 * Touching the chat log must leave the pointer where it is.
 *
 * The exclusion zones exist so the parts of Foundry that already work on a touch screen keep
 * working: native momentum scrolling in the chat log cannot be reproduced convincingly by
 * synthesising wheel events. If the module swallows those touches, scrolling chat stops working and
 * the pointer wanders every time you try.
 *
 * Asserted behaviourally rather than by checking a selector list, because a selector list can agree
 * with itself while matching nothing. Auditing those selectors against a live 14.365 on 2026-08-09
 * found exactly that: `#chat-log` matched zero elements, since v14 renders `<ol class="chat-log">`
 * and the id belongs to the v12 markup. The behaviour had survived only because `.chat-scroll`
 * happens to wrap the log.
 */
export async function checkChatLogIsExcluded(
  page: Page,
  finger: Finger,
  recorder: Recorder
): Promise<void> {
  // An earlier check parks the sidebar on the combat tab, which hides the chat log entirely. Without
  // this the check reported "no visible chat log found", which reads as a missing element rather
  // than as a test ordering problem.
  await page.evaluate(() => {
    ui.sidebar.changeTab('chat', 'primary');
  });
  await page
    .waitForFunction(
      () => {
        const log = document.querySelector('.chat-log, #chat-log');
        return log !== null && log.getBoundingClientRect().height > 10;
      },
      undefined,
      { timeout: 5000 }
    )
    .catch(() => undefined);

  /*
   * The first candidate with real geometry wins, rather than the first that exists.
   *
   * `.chat-log` on 14.365 resolves to an <ol> that reports a height of ZERO even with the chat tab
   * active and the sidebar expanded, while `.chat-scroll` around it has the real box. Asking only
   * for the log therefore reported "no chat log found", which reads as a missing element rather
   * than as the wrong one of two.
   */
  const box = await page.evaluate(() => {
    for (const selector of ['.chat-scroll', '.chat-log', '#chat-log', '#chat']) {
      const element = document.querySelector(selector);
      if (element === null) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width >= 10 && rect.height >= 10) {
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, via: selector };
      }
    }
    return null;
  });

  if (box === null) {
    /*
     * ⚠️ SKIP, not FAIL, and it recorded a false until 2026-08-12. The harness could not find a chat
     * log with a usable box, which says nothing whatever about whether the module leaves the pointer
     * alone. Its own detail said "could not be exercised" while its verdict blamed the module.
     */
    recorder.skip(
      'touching the chat log leaves the pointer alone',
      'no chat region with a usable box, so the exclusion could not be exercised'
    );
    return;
  }

  const before = await pointerPosition(page);
  await finger.drag(box.x, box.y, 0, -60, 6);
  const after = await pointerPosition(page);

  const movedX = Math.abs(after.x - before.x);
  const movedY = Math.abs(after.y - before.y);

  recorder.record(
    'touching the chat log leaves the pointer alone',
    movedX < 1 && movedY < 1,
    `dragged 60px up inside ${box.via} and the pointer moved (${movedX.toFixed(1)}, ` +
      `${movedY.toFixed(1)}), which should be zero`
  );
}
