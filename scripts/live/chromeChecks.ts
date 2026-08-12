import type { Page } from 'playwright';

import { MODULE_ID } from '../foundry-session.ts';
import type { Recorder } from './recorder.ts';

/**
 * Whether Foundry's own chrome responds to a synthesised click. Extracted from foundry-live-check 2026-08-12. This is the check that asks about FOUNDRY rather than about the module, which is why it is worth being able to point at on its own when it fails.
 */

/**
 * The HTML chrome half: does Foundry's own click handling accept a synthesised click.
 *
 * Asserted against ui.sidebar.tabGroups rather than against a CSS class, because that is Foundry's
 * own record of which tab is active. A class check would pass on a tab that merely looks selected.
 */
export async function checkChromeRespondsToClick(page: Page, recorder: Recorder) {
  const before = await page.evaluate(() => ui.sidebar.tabGroups.primary);
  const target = before === 'combat' ? 'chat' : 'combat';

  const moved = await page.evaluate(
    ({ id, tab }) => {
      const button = document.querySelector(`button[data-tab="${tab}"]`);
      if (button === null) {
        return { ok: false, reason: `no sidebar button for '${tab}'` };
      }
      const box = button.getBoundingClientRect();
      const pointer = game.modules.get(id).api.getPointer();
      pointer.moveTo({ clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 });
      const over = pointer.getCurrentTarget();
      pointer.leftClick();
      return { ok: true, hovered: over?.dataset?.tab ?? over?.tagName ?? null };
    },
    { id: MODULE_ID, tab: target }
  );

  if (!moved.ok) {
    // A failure always carries a reason, but only the failing branch sets one, so the type is
    // optional. Naming the fallback keeps a missing reason visible rather than printing "undefined".
    recorder.record(
      'foundry chrome responds to a synthesised click',
      false,
      moved.reason ?? 'no reason recorded'
    );
    return;
  }

  // Polled rather than slept: the tab switch is synchronous today, and a fixed wait would be both
  // slower than needed and silently wrong if it ever stops being.
  const after = await page
    .waitForFunction((tab) => ui.sidebar.tabGroups.primary === tab, target, { timeout: 5000 })
    .then(() => target)
    .catch(async () => page.evaluate(() => ui.sidebar.tabGroups.primary));

  recorder.record(
    'foundry chrome responds to a synthesised click',
    after === target,
    `hovered=${moved.hovered} tab ${before} -> ${after} (wanted ${target})`
  );
}
