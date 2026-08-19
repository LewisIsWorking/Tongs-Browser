import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FoundryAccess } from '../../src/foundry/FoundryAccess.js';

/**
 * Reaching for Foundry's globals when Foundry may not have defined them.
 *
 * ⚠️ THE POINT OF THIS FILE IS THE GUARDS, and they were the uncovered half at 54%. Every method
 * opens with `typeof x === 'undefined'`, and the docblock claims that is not redundant with the
 * declared type: a global Foundry has never defined throws a **ReferenceError** on plain access, and
 * an optional chain does not help, because the reference itself is what throws.
 *
 * That claim is worth pinning rather than trusting. Without a test, the guards read as defensive
 * clutter and the obvious "tidy-up" is to replace them with `game?.keyboard ?? null`, which compiles,
 * looks cleaner, and throws the moment it runs anywhere Foundry has not booted.
 *
 * ⚠️ These `delete` the globals rather than setting them to undefined. Those are different states: a
 * declared-but-undefined global is safe to reference, an undeclared one throws, and only the second
 * reproduces what the guards exist for.
 */
type MutableGlobal = Record<string, unknown>;

const globals = globalThis as unknown as MutableGlobal;
const saved: MutableGlobal = {};

beforeEach(() => {
  for (const key of ['game', 'canvas', 'CONFIG']) {
    saved[key] = globals[key];
    Reflect.deleteProperty(globals, key);
  }
  document.body.innerHTML = '';
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      Reflect.deleteProperty(globals, key);
    } else {
      globals[key] = value;
    }
  }
});

describe('when Foundry has not defined its globals at all', () => {
  it('reports no keyboard manager rather than throwing a ReferenceError', () => {
    const access = new FoundryAccess();

    expect(() => access.resolveKeyboardManager()).not.toThrow();
    expect(access.resolveKeyboardManager()).toBeNull();
  });

  it('reports no canvas rather than throwing', () => {
    const access = new FoundryAccess();

    expect(() => access.resolveCanvas()).not.toThrow();
    expect(access.resolveCanvas()).toBeNull();
  });

  /**
   * ⚠️ Null, not NaN. A pinch built on NaN scales silently produces a canvas transform of NaN, which
   * blanks the board rather than failing, so the controller needs a value it can recognise as absent.
   */
  it('reports no scale and no pivot, so a pinch is never built on NaN', () => {
    const access = new FoundryAccess();

    expect(access.resolveCanvasScale()).toBeNull();
    expect(access.resolveCanvasPivot()).toBeNull();
  });

  it('still answers with usable zoom limits, since these have moved between versions', () => {
    const access = new FoundryAccess();

    const limits = access.resolveZoomLimits();

    expect(Number.isFinite(limits.minimum)).toBe(true);
    expect(Number.isFinite(limits.maximum)).toBe(true);
    expect(limits.maximum).toBeGreaterThan(limits.minimum);
  });
});

describe('when Foundry has defined them', () => {
  it('hands back the keyboard manager it was given', () => {
    const keyboard = { downKeys: new Set<string>() };
    globals['game'] = { keyboard };

    expect(new FoundryAccess().resolveKeyboardManager()).toBe(keyboard);
  });

  /** A `game` without a keyboard is not the same as no `game`, and both must answer null. */
  it('reports null when the game exists but exposes no keyboard', () => {
    globals['game'] = {};

    expect(new FoundryAccess().resolveKeyboardManager()).toBeNull();
  });

  it('hands back the canvas it was given', () => {
    const canvas = { stage: { scale: { x: 1 }, pivot: { x: 0, y: 0 } } };
    globals['canvas'] = canvas;

    expect(new FoundryAccess().resolveCanvas()).toBe(canvas);
  });

  it('reads the scale and pivot live from the stage', () => {
    globals['canvas'] = { stage: { scale: { x: 2.5 }, pivot: { x: 40, y: 60 } } };
    const access = new FoundryAccess();

    expect(access.resolveCanvasScale()).toBe(2.5);
    expect(access.resolveCanvasPivot()).toEqual({ x: 40, y: 60 });
  });
});

/**
 * The bar must not be laid out over Foundry's sidebar icon column, which on a phone is the only route
 * to chat, actors and everything else. Covering it costs far more than covering a single button.
 */
describe('the width the modifier bar may use', () => {
  it('is the whole window when there is no sidebar', () => {
    expect(new FoundryAccess().resolveAvailableWidth()).toBe(window.innerWidth);
  });

  it('stops short of a sidebar that is actually in the way', () => {
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar';
    document.body.append(sidebar);
    Object.defineProperty(sidebar, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: window.innerWidth - 120, right: window.innerWidth, width: 120 }),
    });

    expect(new FoundryAccess().resolveAvailableWidth()).toBeLessThan(window.innerWidth);
  });
});
