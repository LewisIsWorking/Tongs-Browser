import type { Page } from 'playwright';
import { record, skip } from './CheckResults.ts';
import { MODULE_ID } from '../foundry-session.ts';
import { Finger } from '../foundry-touch.ts';

/**
 * Does a tap click at the POINTER rather than under the finger? Extracted from
 * foundry-android-check 2026-08-12.
 */
/**
 * Tap clicks at the pointer, not under the finger. The trackpad model, on real hardware.
 *
 * Judged by Foundry's own sidebar state rather than by a CSS class, and deliberately with the finger
 * far away from the pointer, so a pass cannot come from the two happening to coincide.
 */
export async function checkTapClicksAtPointer(page: Page, finger: Finger): Promise<void> {
  const target = await page.evaluate(() => {
    const tab = document.querySelector('button[data-tab="combat"]');
    if (!tab) return null;
    const r = tab.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, before: ui.sidebar.tabGroups.primary };
  });

  if (target === null) {
    skip(
      'tap clicks at the pointer rather than under the finger',
      'no combat sidebar tab to aim at'
    );
    return;
  }

  // moveTo takes one PointerPosition, not two numbers. Passing two silently produces a NaN
  // position, which surfaces much later as "elementFromPoint: the provided double value is
  // non-finite" from inside the module, and reads as a module crash rather than a caller mistake.
  await page.evaluate(
    ({ id, x, y }) => game.modules.get(id).api.getPointer().moveTo({ clientX: x, clientY: y }),
    { id: MODULE_ID, x: target.x, y: target.y }
  );

  /*
   * Pick the tap point by asking the page what is actually there, rather than hardcoding one.
   *
   * A fixed (60, 400) is a perfectly good spot on a 1600px desktop window and a bad one on a 412px
   * phone, where x 60 is inside Foundry's scene control column. Tapping chrome instead of the board
   * made this check fail for a reason that had nothing to do with the behaviour under test, which is
   * the failure mode that wastes the most time: a red result that accuses the feature.
   */
  const spot = await page.evaluate(() => {
    const board = document.querySelector('#board');
    if (!board) return null;
    const r = board.getBoundingClientRect();

    /*
     * Scan for a point that genuinely hits the board rather than trusting the centre. The centre is
     * the worst candidate on a paused world, because Foundry puts its GAME PAUSED banner exactly
     * there, and a <p> over the board is indistinguishable from a broken pointer if you only look at
     * the result.
     */
    const fractions = [0.5, 0.35, 0.65, 0.25, 0.75];
    for (const fy of fractions) {
      for (const fx of fractions) {
        const x = Math.round(r.x + r.width * fx);
        const y = Math.round(r.y + r.height * fy);
        const top = document.elementFromPoint(x, y);
        const over = top ? `${top.tagName.toLowerCase()}.${String(top.className)}` : '';
        if (/board|canvas/i.test(over)) {
          return { x, y, over };
        }
      }
    }

    const centre = document.elementFromPoint(
      Math.round(r.x + r.width / 2),
      Math.round(r.y + r.height / 2)
    );
    return {
      x: null,
      y: null,
      over: centre ? `${centre.tagName.toLowerCase()}.${String(centre.className)}` : null,
    };
  });

  if (spot === null || spot.x === null) {
    skip(
      'tap clicks at the pointer rather than under the finger',
      `no point on #board was clear; the centre is covered by ${spot?.over ?? 'nothing'}`
    );
    return;
  }

  // Far from the pointer, and confirmed to be over the board, so nothing native could do it.
  await finger.tap(spot.x, spot.y);
  await page.waitForTimeout(600);

  const after = await page.evaluate(() => ui.sidebar.tabGroups.primary);

  if (after === 'combat' && target.before !== 'combat') {
    record(
      'tap clicks at the pointer rather than under the finger',
      true,
      `pointer parked on the combat tab, finger tapped at (${spot.x},${spot.y}) over ${spot.over}, sidebar went ${target.before} -> ${after}`
    );
    return;
  }

  /*
   * The tap did not activate the tab. Establish WHOSE fault that is before reporting it, the same
   * way the hover check does, because "tap is broken" and "this page ignores scripted clicks" look
   * identical from the outside and lead to completely different work.
   *
   * The control is a plain scripted click on the same element with the module bypassed. Measured
   * 2026-08-10 on the Chromium 133 emulator: the control switched the tab while the module's tap
   * delivered pointerdown, mousedown, pointerup and mouseup to the right element and never a click.
   * That is a real gap rather than an environment limit, so it is reported as a failure and the
   * detail says exactly which events did arrive.
   */
  const control = await page.evaluate(async () => {
    const tab = document.querySelector('button[data-tab="combat"]');
    /*
     * ⚠️ The control has to survive a missing tab, and this guard is why. Reading `addEventListener`
     * off null throws INSIDE the page, which rejects the evaluate and takes down the entire run, so
     * the one thing written to establish whose fault a failure is would itself become the failure.
     * A control that cannot report is worse than no control.
     */
    if (tab === null) {
      return { before: null, after: null, seen: [] as string[], missing: true };
    }

    const seen: string[] = [];
    const spy = (event: Event): number => seen.push(event.type);
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      tab.addEventListener(type, spy, { once: true });
    }
    const before: string = ui.sidebar.tabGroups.primary;
    tab.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window, detail: 1 })
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 600);
    });
    return {
      before,
      after: ui.sidebar.tabGroups.primary as string,
      seen,
      missing: false,
    };
  });

  if (control.missing) {
    skip(
      'tap clicks at the pointer rather than under the finger',
      'the combat tab is not in the page, so there was nothing to click and nothing to conclude'
    );
    return;
  }

  if (control.after !== 'combat') {
    skip(
      'tap clicks at the pointer rather than under the finger',
      `this page does not respond to a scripted click at all: a plain click dispatched straight at ` +
        `the tab, with the module bypassed, left the sidebar on ${control.after}. Nothing about the ` +
        `module can be concluded from that.`
    );
    return;
  }

  record(
    'tap clicks at the pointer rather than under the finger',
    false,
    `pointer parked on the combat tab, finger tapped at (${spot.x},${spot.y}) over ${spot.over}, ` +
      `sidebar stayed on ${after}. A plain scripted click on the SAME element does switch it ` +
      `(${control.before} -> ${control.after}), so the page is fine and the tap is not producing an ` +
      `activation the tab acts on.`
  );
}
