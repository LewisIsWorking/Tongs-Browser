import type { Page } from 'playwright';

import { MODULE_ID } from '../foundry-session.ts';
import type { Recorder } from './recorder.ts';

/**
 * The scene control toggle: registered, rendered, reachable, and actually toggling. Extracted from foundry-live-check 2026-08-12, which had reached 349 lines against a hard 200 limit. Kept whole because its four assertions are one story: a control that exists but is covered by the bar is exactly as useless as one that was never created, and splitting them would let either half pass alone and read as health.
 */

/**
 * The scene control toggle exists, and toggling it actually turns the module off and on.
 *
 * This is the module's escape hatch: if the pointer misbehaves mid session, reaching the settings
 * dialog means using the pointer to get there, which is the thing that is not working. So it is the
 * one control that has to work when nothing else does.
 *
 * It was completely absent on Foundry 14 until 2026-08-09, for two independent reasons, both
 * measured rather than guessed: the hook was registered at `ready` when Foundry builds the controls
 * exactly once before that, and the group is called `tokens` while the code looked for `token`.
 *
 * Judged by Foundry's own control state AND by the DOM, because either alone can lie: the state can
 * hold a tool that never renders, and a rendered button can be a leftover.
 */
export async function checkSceneControlToggle(page: Page, recorder: Recorder) {
  const present = await page.evaluate((id) => {
    const groups = ui.controls.controls;
    const inGroup = Object.entries(
      groups as Record<string, { tools?: Record<string, unknown> }>
    ).find(([, group]) => Object.keys(group.tools ?? {}).includes(id));
    return {
      group: inGroup?.[0] ?? null,
      groupNames: Object.keys(groups),
      inDom: document.querySelectorAll(`[data-tool="${id}"]`).length,
    };
  }, MODULE_ID);

  recorder.record(
    'scene control toggle is registered in the tokens group',
    present.group === 'tokens',
    `found in ${present.group ?? 'no group'}, of ${present.groupNames.join(', ')}`
  );

  recorder.record(
    'scene control toggle is rendered in the toolbar',
    present.inDom === 1,
    `${present.inDom} element(s) matching [data-tool="${MODULE_ID}"]`
  );

  if (present.inDom !== 1) {
    return;
  }

  /*
   * The toggle must not merely exist, it must be REACHABLE.
   *
   * At the default bar position of x 16 it was not. Measured on 14.365: the scene control toolbar
   * runs x 12 to 66 down the left edge, the bar was 445x54 at (16, 120), and the toggle at x 42 to
   * 66, y 132 to 156 was entirely underneath it. elementFromPoint at the toggle's centre returned
   * the bar's own collapse button, so a real finger could never have hit it.
   *
   * Judged by hit testing rather than by comparing rectangles, because that is the question a finger
   * asks. The default moved to x 88 to clear the toolbar.
   */
  const reachable = await page.evaluate((id) => {
    const button = document.querySelector(`[data-tool="${id}"]`);
    if (button === null) {
      throw new Error(`no [data-tool="${id}"] control: the scene control was never created.`);
    }
    const box = button.getBoundingClientRect();
    const topmost = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return {
      topmost: topmost ? `${topmost.tagName.toLowerCase()}.${String(topmost.className)}` : null,
      isTheToggle: button === topmost || button.contains(topmost),
    };
  }, MODULE_ID);

  recorder.record(
    'the scene control toggle is not covered by the modifier bar',
    reachable.isTheToggle,
    `topmost element at the toggle's centre is ${reachable.topmost}`
  );

  /*
   * Invoked through the tool's own onChange, which is the callback Foundry calls, rather than by
   * clicking the button.
   *
   * ⚠️ THE LIMIT IS DELIBERATE AND WORTH STATING. This proves the wiring behind the button is
   * correct: the callback Foundry will invoke does flip the module and persist the setting. It does
   * NOT prove Foundry's own click routing reaches that callback, because a synthetic mouse click on
   * the button was measured not to trigger its data-action="tool" handler, which is a limitation of
   * the harness rather than a finding about the module.
   *
   * Reachability, the part a finger cares about, is asked separately above by hit testing. Between
   * the two, the only thing left unproven is Foundry's internal dispatch, which is Foundry's to get
   * right and which the device checklist still exercises.
   *
   * Toggled twice, so the world's saved setting ends where it started.
   */
  const before = await page.evaluate((id) => game.modules.get(id).api.isEnabled(), MODULE_ID);

  const fire = async () => {
    await page.evaluate((id) => {
      ui.controls.controls.tokens?.tools?.[id]?.onChange?.();
    }, MODULE_ID);
    await page.waitForTimeout(400);
    return page.evaluate((id) => game.modules.get(id).api.isEnabled(), MODULE_ID);
  };

  const middle = await fire();
  const after = await fire();

  recorder.record(
    'the scene control toggle actually toggles the module',
    middle === !before && after === before,
    `enabled ${before} -> ${middle} -> ${after}, so it flipped and came back`
  );
}
