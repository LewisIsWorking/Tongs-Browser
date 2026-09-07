import { describe, expect, it, vi } from 'vitest';

import {
  COARSE_POINTER_QUERY,
  describeDeviceChoice,
  looksLikeTouchDevice,
} from '../../src/core/TouchDevice.js';

/**
 * Whether this device wants a finger driven pointer. Written 2026-09-07.
 *
 * ⛔ THE BUG. `Enabled` defaulted to true everywhere, so opening Foundry on a desktop got a virtual
 * cursor, a modifier bar and the interface shrunk to 75%. There was no device detection of any kind:
 * the only `navigator.userAgent` in the whole module is a line of diagnostics text.
 */
/** A window that answers the coarse query one way, and optionally reports touch hardware too. */
const win = (coarse: boolean, maxTouchPoints = 0): Parameters<typeof looksLikeTouchDevice>[0] => ({
  matchMedia: (query: string) => ({ matches: query === COARSE_POINTER_QUERY && coarse }),
  navigator: { maxTouchPoints },
});

describe('looksLikeTouchDevice', () => {
  it('says yes when the primary pointer is coarse, as on a phone', () => {
    expect(looksLikeTouchDevice(win(true))).toBe(true);
  });

  it('says no when the primary pointer is fine, as on a desktop', () => {
    expect(looksLikeTouchDevice(win(false))).toBe(false);
  });

  /**
   * ⛔ THE CASE THAT DECIDES THE DESIGN. A touchscreen laptop has touch hardware AND a mouse, so
   * `maxTouchPoints` says yes while the user is holding a mouse. `(pointer: coarse)` asks about the
   * PRIMARY input, and answers no, which is right: a virtual cursor driven by a real cursor is
   * absurd. Testing capability rather than primacy would switch the module on beside a good mouse.
   */
  it('says no for a touchscreen laptop, where touch exists but a mouse is primary', () => {
    expect(looksLikeTouchDevice(win(false, 10))).toBe(false);
  });

  /** ⚠️ It asks the RIGHT query, not merely some query. A typo would match nothing and read as a desktop. */
  it('asks about the primary pointer being coarse', () => {
    const matchMedia = vi.fn((query: string) => ({ matches: query.length > 0 }));

    looksLikeTouchDevice({ matchMedia });

    expect(matchMedia).toHaveBeenCalledWith('(pointer: coarse)');
  });
});

describe('when matchMedia is missing', () => {
  /** ⚠️ Fallback only. A wrong guess beats no guess on a browser too old to answer properly. */
  it('falls back to touch points existing', () => {
    expect(looksLikeTouchDevice({ navigator: { maxTouchPoints: 5 } })).toBe(true);
    expect(looksLikeTouchDevice({ navigator: { maxTouchPoints: 0 } })).toBe(false);
  });

  /**
   * ⚠️ Knowing NOTHING means off, and the direction is deliberate. A phone with the module off shows
   * a normal Foundry the user can switch it on in; a desktop with it on shows a shrunken interface
   * with a cursor fighting the real one, and the control to fix that is inside the misbehaving thing.
   */
  it('says no when it can learn nothing at all', () => {
    expect(looksLikeTouchDevice({})).toBe(false);
    expect(looksLikeTouchDevice({ navigator: {} })).toBe(false);
  });
});

describe('what it says about the decision', () => {
  /** ⚠️ Both halves reachable by a test, which is why this is not a ternary at the composition root. */
  it('says it started enabled when the pointer is coarse', () => {
    expect(describeDeviceChoice(true)).toContain('starts enabled');
  });

  /** ⚠️ Says how to override it. A message that only reports a decision leaves the user stuck with it. */
  it('says it started disabled, and how to change that', () => {
    const said = describeDeviceChoice(false);

    expect(said).toContain('starts disabled');
    expect(said).toContain('scene control');
  });
});
