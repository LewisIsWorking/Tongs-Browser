import type { Page } from 'playwright';
import { MODULE_ID } from '../foundry-session.ts';

/** Matches DEFAULT_POSITION in src/modifiers/BarPosition.ts. */
const DEFAULT_BAR_POSITION = { x: 88, y: 120 };

/**
 * Put the bar where it ships, and remember where it was. Extracted from foundry-android-check
 * 2026-08-12.
 *
 * ⚠️ The geometry checks must judge the SHIPPED DEFAULT, not wherever the bar was last dragged to.
 * A world used for testing has a bar somewhere convenient, so running against it measures a position
 * nobody will ever see on a fresh install, which is the only position the default can be wrong at.
 */
export async function moveBarToDefault(page: Page): Promise<unknown> {
  const previous = await page.evaluate(
    ({ id, position }) => {
      const before = game.settings.get(id, 'barPosition');
      game.settings.set(id, 'barPosition', position);
      return before;
    },
    { id: MODULE_ID, position: DEFAULT_BAR_POSITION }
  );
  // The bar reflows on the setting change, so the geometry read must come after it has settled.
  await page.waitForTimeout(500);
  return previous;
}

/**
 * Put it back.
 *
 * ⚠️ Failure is reported and swallowed rather than thrown. This runs in a `finally`, and a throw here
 * would replace whatever the checks actually found with a cleanup error, which is the least useful
 * possible outcome of a run.
 */
export async function restoreBarPosition(page: Page, position: unknown): Promise<void> {
  if (position === null) {
    return;
  }
  await page
    .evaluate(({ id, saved }) => game.settings.set(id, 'barPosition', saved), {
      id: MODULE_ID,
      saved: position,
    })
    .catch(() => {
      console.error('could not restore the original modifier bar position');
    });
}
