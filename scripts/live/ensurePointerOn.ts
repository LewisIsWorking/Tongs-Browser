import type { Page } from 'playwright';

import { MODULE_ID } from '../foundry-session.ts';

/**
 * Turn the pointer on. It defaults to off on a device with a mouse, which headless Chromium counts as, so
 * without this every overlay check fails on a module that is working as designed. It is a setting of this
 * throwaway browser only.
 */
export async function ensurePointerOn(page: Page): Promise<void> {
  await page.evaluate(async (id) => {
    if (game.modules.get(id)?.api?.isEnabled() !== true) {
      await game.settings.set(id, 'enabled', true);
    }
  }, MODULE_ID);
  await page.waitForFunction(() => document.querySelector('.tb-cursor') !== null, undefined, {
    timeout: 30_000,
    polling: 500,
  });
}
