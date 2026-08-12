import type { Page } from 'playwright';
import { record } from './CheckResults.js';

/**
 * Does Foundry honour a synthesised keyboard event on Android? Extracted from
 * foundry-android-check 2026-08-12.
 */
/**
 * The module's own report of the keyboard strategy, checked against an independent measurement.
 *
 * Trusting the log line alone would test the module's opinion of itself. This dispatches a shift
 * keydown and asks Foundry's own KeyboardManager whether it registered, which is the thing the
 * modifier bar depends on and the only answer that matters.
 */
export async function checkKeyboardStrategy(page: Page, log: readonly string[]): Promise<void> {
  const reported =
    log.find((line) => line.includes('Keyboard strategy:'))?.match(/strategy: (\w+)/)?.[1] ?? null;

  /*
   * ⚠️ A single shape rather than a union of two, so `reason` is always a string.
   *
   * Left as a union, `measured.reason` typed as `string | undefined` and the unusable branch reported
   * its failure with a detail of literally `undefined`. That is the one case where the detail is the
   * entire finding: "Foundry honours synthesised keyboard events: false" says nothing on its own,
   * because "Foundry ignored the event" and "there is no downKeys to look at" are different problems
   * with different fixes and this check is the only thing that can tell them apart.
   */
  const measured: {
    usable: boolean;
    reason: string;
    isTrusted: boolean;
    downKeysType: string;
    honoured: boolean;
  } = await page.evaluate(() => {
    const unusable = {
      usable: false,
      isTrusted: false,
      downKeysType: 'unknown',
      honoured: false,
    };
    const manager = globalThis.game?.keyboard;
    if (!manager?.downKeys) {
      return { ...unusable, reason: 'game.keyboard.downKeys is not there at all' };
    }
    const before = manager.downKeys.has('ShiftLeft');
    const event = new KeyboardEvent('keydown', {
      key: 'Shift',
      code: 'ShiftLeft',
      shiftKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
    const after = manager.downKeys.has('ShiftLeft');
    window.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Shift', code: 'ShiftLeft', bubbles: true })
    );
    return {
      usable: true,
      reason: '',
      isTrusted: event.isTrusted,
      downKeysType: manager.downKeys.constructor?.name ?? 'unknown',
      honoured: after && !before,
    };
  });

  record(
    'the module reports a keyboard strategy on Android',
    reported !== null,
    `logged: ${reported ?? 'nothing'}`
  );

  if (!measured.usable) {
    record('Foundry honours synthesised keyboard events on Android', false, measured.reason);
    return;
  }

  record(
    'Foundry honours synthesised keyboard events on Android',
    measured.honoured === true,
    `isTrusted=${measured.isTrusted}, downKeys is a ${measured.downKeysType}, registered=${measured.honoured}`
  );

  record(
    'the strategy measured on Android agrees with the one the module reports',
    (measured.honoured && reported === 'events') || (!measured.honoured && reported !== 'events'),
    `independent measurement says ${measured.honoured ? 'honoured' : 'not honoured'}, module says ${reported}`
  );
}
