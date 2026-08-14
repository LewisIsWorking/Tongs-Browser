import { describe, expect, it, vi } from 'vitest';

import { applySetting, readGestureConfig } from '../../src/settings/ApplySetting.ts';
import { SettingKey, type SettingKeyValue } from '../../src/settings/SettingDefinitions.ts';

/**
 * What actually happens when a player changes a setting mid session.
 *
 * ⚠️ This file shipped at 0% coverage, and the shape of that gap is worth naming. It is a
 * COMPOSITION file: it contains almost no logic, only the mapping from a changed key to the method
 * that applies it. Files like this are the ones nobody tests, because there is visibly nothing in
 * them to get wrong - and they are exactly where a wire goes missing.
 *
 * That is not a theory. The bug fixed the day before this was written was `BuildModifierBar` quietly
 * omitting two options it had been given, in a file of the same kind, with every component around it
 * correct and covered.
 *
 * The failure mode here is silent by construction. A key mapped to the wrong method does something
 * visibly wrong; a key mapped to NOTHING just leaves the user adjusting a slider that does not move
 * anything, with no error anywhere. So the do-nothing cases are asserted as deliberately as the rest.
 */
const spies = () => ({
  enable: vi.fn(),
  disable: vi.fn(),
  updateGestureConfig: vi.fn(),
  setCursorSize: vi.fn(),
  setUiScale: vi.fn(),
  setModifierBarVisible: vi.fn(),
  setDebugOverlay: vi.fn(),
});

type Spies = ReturnType<typeof spies>;

const store = (values: { boolean?: boolean; number?: number } = {}) => ({
  getBoolean: vi.fn(() => values.boolean ?? true),
  getNumber: vi.fn(() => values.number ?? 42),
  getPointerMode: vi.fn(() => 'trackpad' as const),
});

/** Applied through the real signature, with fakes standing in for the two collaborators. */
const apply = (key: SettingKeyValue, instance: Spies, backing = store()) => {
  applySetting(key, {
    instance: instance as unknown as Parameters<typeof applySetting>[1]['instance'],
    store: backing as unknown as Parameters<typeof applySetting>[1]['store'],
  });
};

describe('before the module exists', () => {
  /**
   * ⚠️ Foundry fires the change hook whenever a setting is written, including during registration and
   * before `ready`. Throwing here would take down the settings dialog for a value the module cannot
   * apply yet, which is a far worse outcome than doing nothing.
   */
  it('does nothing when there is no instance to apply to', () => {
    const instance = spies();

    applySetting(SettingKey.ENABLED, { instance: null, store: store() as never });

    expect(instance.enable).not.toHaveBeenCalled();
  });

  it('does nothing when the settings store is not ready', () => {
    const instance = spies();

    expect(() => {
      applySetting(SettingKey.ENABLED, { instance: instance as never, store: null });
    }).not.toThrow();
    expect(instance.enable).not.toHaveBeenCalled();
  });
});

describe('settings that take effect immediately', () => {
  it('enables and disables from the stored value, not from the key alone', () => {
    const on = spies();
    apply(SettingKey.ENABLED, on, store({ boolean: true }));
    expect(on.enable).toHaveBeenCalledOnce();
    expect(on.disable).not.toHaveBeenCalled();

    const off = spies();
    apply(SettingKey.ENABLED, off, store({ boolean: false }));
    expect(off.disable).toHaveBeenCalledOnce();
    expect(off.enable).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ All five rebuild the WHOLE gesture config rather than patching one field. Reading them
   * together is what stops the config describing two different moments, which is the defect that
   * produced five separate wrong readings in the diagnostics report.
   */
  it.each([
    SettingKey.POINTER_MODE,
    SettingKey.SENSITIVITY,
    SettingKey.OFFSET_DISTANCE,
    SettingKey.LONG_PRESS_MS,
    SettingKey.HAPTICS,
  ])('rebuilds the gesture config for %s', (key) => {
    const instance = spies();

    apply(key, instance);

    expect(instance.updateGestureConfig).toHaveBeenCalledOnce();
    expect(instance.updateGestureConfig.mock.calls[0]?.[0]).toEqual({
      pointerMode: 'trackpad',
      sensitivity: 42,
      offsetDistancePx: 42,
      longPressMs: 42,
      haptics: true,
    });
  });

  it('applies the cursor size, the interface scale, the bar and the overlay', () => {
    const cursor = spies();
    apply(SettingKey.CURSOR_SIZE, cursor);
    expect(cursor.setCursorSize).toHaveBeenCalledWith(42);

    const scale = spies();
    apply(SettingKey.UI_SCALE, scale);
    expect(scale.setUiScale).toHaveBeenCalledWith(42);

    const bar = spies();
    apply(SettingKey.MODIFIER_BAR_ENABLED, bar);
    expect(bar.setModifierBarVisible).toHaveBeenCalledWith(true);

    const overlay = spies();
    apply(SettingKey.DEBUG_OVERLAY, overlay);
    expect(overlay.setDebugOverlay).toHaveBeenCalledWith(true);
  });
});

/**
 * ⚠️ Doing nothing is a DECISION here, and each of these three has its own reason. Asserted rather
 * than left implicit, because "this key does nothing" and "somebody forgot this key" look identical
 * in the code and produce the same silence at runtime.
 */
describe('settings that deliberately apply nothing', () => {
  it.each([
    [SettingKey.SUPPRESS_NATIVE_TOUCH, 'read through a getter on every event'],
    [SettingKey.BAR_POSITION, 'written by the bar itself, mid drag'],
    [SettingKey.BAR_COLLAPSED, 'written by the bar itself, from its own button'],
  ])('touches nothing for %s, because it is %s', (key, reason) => {
    const instance = spies();

    apply(key, instance);

    for (const [name, spy] of Object.entries(instance)) {
      expect(spy, `${name} was called for ${key}, which is ${reason}`).not.toHaveBeenCalled();
    }
  });
});

describe('reading the gesture config', () => {
  /** One read of each, in one object, so the config cannot mix two moments. */
  it('reads every gesture setting together', () => {
    const backing = store({ boolean: false, number: 7 });

    expect(readGestureConfig(backing as never)).toEqual({
      pointerMode: 'trackpad',
      sensitivity: 7,
      offsetDistancePx: 7,
      longPressMs: 7,
      haptics: false,
    });
  });
});
