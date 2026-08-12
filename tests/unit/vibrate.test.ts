import { describe, expect, it, vi } from 'vitest';

import { vibrate } from '../../src/core/Vibrate.js';

/**
 * Haptic feedback, where the device has any.
 */
describe('vibrate', () => {
  it('buzzes for the duration asked for', () => {
    const buzz = vi.fn();
    vibrate({ navigator: { vibrate: buzz } } as unknown as Window, 15);

    expect(buzz).toHaveBeenCalledWith(15);
  });

  /**
   * ⚠️ Feature detected at the CALL SITE rather than trusted from the type. `lib.dom` declares
   * `navigator.vibrate` as always present, so nothing in the type system objects to calling it. It
   * is absent on iOS entirely, and a call would throw rather than do nothing.
   */
  it('does nothing at all where the device has no vibrator', () => {
    expect(() => {
      vibrate({ navigator: {} } as unknown as Window, 15);
    }).not.toThrow();
  });

  it('does nothing when vibrate is present but is not callable', () => {
    expect(() => {
      vibrate({ navigator: { vibrate: 'yes' } } as unknown as Window, 15);
    }).not.toThrow();
  });
});
