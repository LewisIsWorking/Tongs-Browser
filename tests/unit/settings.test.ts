import { describe, expect, it, vi } from 'vitest';

import { MODULE_ID } from '../../src/constants.js';
import {
  SETTING_DEFINITIONS,
  SettingKey,
  clampToRange,
  findSetting,
} from '../../src/settings/SettingDefinitions.js';
import { SettingsStore, type SettingsBackend } from '../../src/settings/SettingsStore.js';

function createBackend(values: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(values));
  const backend: SettingsBackend = {
    register: vi.fn(),
    get: (_namespace, key) => store.get(key),
    set: (_namespace, key, value) => {
      store.set(key, value);
      return undefined;
    },
  };
  return { backend, store };
}

describe('setting definitions', () => {
  it('covers every setting the brief lists', () => {
    const keys = SETTING_DEFINITIONS.map((definition) => definition.key);

    expect(keys).toContain(SettingKey.ENABLED);
    expect(keys).toContain(SettingKey.POINTER_MODE);
    expect(keys).toContain(SettingKey.SENSITIVITY);
    expect(keys).toContain(SettingKey.CURSOR_SIZE);
    expect(keys).toContain(SettingKey.OFFSET_DISTANCE);
    expect(keys).toContain(SettingKey.LONG_PRESS_MS);
    expect(keys).toContain(SettingKey.HAPTICS);
    expect(keys).toContain(SettingKey.SUPPRESS_NATIVE_TOUCH);
    expect(keys).toContain(SettingKey.MODIFIER_BAR_ENABLED);
    expect(keys).toContain(SettingKey.UI_SCALE);
    expect(keys).toContain(SettingKey.DEBUG_OVERLAY);
  });

  it.each([
    [SettingKey.SENSITIVITY, 0.5, 3, 1.5],
    [SettingKey.CURSOR_SIZE, 16, 48, 28],
    [SettingKey.OFFSET_DISTANCE, 0, 120, 60],
    [SettingKey.LONG_PRESS_MS, 300, 1000, 500],
    [SettingKey.UI_SCALE, 0.5, 1, 0.75],
  ])('gives %s the range and default from the brief', (key, min, max, fallback) => {
    const definition = findSetting(key);

    expect(definition?.kind).toBe('number');
    if (definition?.kind === 'number') {
      expect(definition.range.min).toBe(min);
      expect(definition.range.max).toBe(max);
      expect(definition.default).toBe(fallback);
    }
  });

  /**
   * Every player configures their own device. A GM on a desktop and a player on a phone want
   * opposite values for nearly all of these, and world scope would force them to share.
   */
  it('registers everything as client scope', () => {
    const { backend } = createBackend();
    new SettingsStore({ backend }).registerAll();

    const calls = vi.mocked(backend.register).mock.calls;
    expect(calls).toHaveLength(SETTING_DEFINITIONS.length);
    for (const [namespace, , data] of calls) {
      expect(namespace).toBe(MODULE_ID);
      expect(data.scope).toBe('client');
    }
  });

  it('keeps the bar position out of the settings form', () => {
    expect(findSetting(SettingKey.BAR_POSITION)?.config).toBe(false);
  });
});

describe('clampToRange', () => {
  const range = { min: 0.5, max: 3, step: 0.1 };

  it('clamps to the boundaries', () => {
    expect(clampToRange(-5, range)).toBe(0.5);
    expect(clampToRange(99, range)).toBe(3);
  });

  it('snaps to the step', () => {
    expect(clampToRange(1.53, range)).toBe(1.5);
    expect(clampToRange(1.57, range)).toBe(1.6);
  });

  it('falls back to the minimum for a value that is not a number', () => {
    expect(clampToRange(Number.NaN, range)).toBe(0.5);
  });

  it('does not leak binary floating point noise into the store', () => {
    for (let raw = 0.5; raw <= 3; raw += 0.07) {
      expect(String(clampToRange(raw, range)).length).toBeLessThanOrEqual(5);
    }
  });

  it('snaps relative to the minimum, not to zero', () => {
    // Steps of 50 from 300 land on 300, 350, 400. Snapping to multiples of 50 from zero would
    // agree here by luck, so a range whose minimum is not a multiple of the step is used.
    expect(clampToRange(317, { min: 300, max: 1000, step: 50 })).toBe(300);
    expect(clampToRange(330, { min: 300, max: 1000, step: 50 })).toBe(350);
  });
});

/**
 * Foundry's settings API returns unknown. Values reach it from older module versions and from users
 * editing stored settings by hand, so every read is validated rather than cast. A cast would push a
 * string straight into the gesture config as a NaN sensitivity.
 */
describe('SettingsStore reading', () => {
  it('returns the stored boolean', () => {
    const { backend } = createBackend({ [SettingKey.ENABLED]: false });
    expect(new SettingsStore({ backend }).getBoolean(SettingKey.ENABLED)).toBe(false);
  });

  it('falls back to the default when the stored value is the wrong type', () => {
    const { backend } = createBackend({ [SettingKey.ENABLED]: 'yes please' });
    expect(new SettingsStore({ backend }).getBoolean(SettingKey.ENABLED)).toBe(true);
  });

  it('falls back to the default when nothing is stored', () => {
    const { backend } = createBackend();
    expect(new SettingsStore({ backend }).getBoolean(SettingKey.HAPTICS)).toBe(true);
  });

  it('clamps a stored number that is outside its range', () => {
    const { backend } = createBackend({ [SettingKey.SENSITIVITY]: 99 });
    expect(new SettingsStore({ backend }).getNumber(SettingKey.SENSITIVITY)).toBe(3);
  });

  it('coerces a numeric string rather than yielding NaN', () => {
    const { backend } = createBackend({ [SettingKey.CURSOR_SIZE]: '32' });
    expect(new SettingsStore({ backend }).getNumber(SettingKey.CURSOR_SIZE)).toBe(32);
  });

  it('falls back to the range minimum for an unparseable number', () => {
    const { backend } = createBackend({ [SettingKey.SENSITIVITY]: 'fast' });
    expect(new SettingsStore({ backend }).getNumber(SettingKey.SENSITIVITY)).toBe(0.5);
  });

  it('returns a valid stored choice', () => {
    const { backend } = createBackend({ [SettingKey.POINTER_MODE]: 'offset' });
    expect(new SettingsStore({ backend }).getPointerMode()).toBe('offset');
  });

  it('rejects a choice that is no longer offered, rather than passing it through', () => {
    const { backend } = createBackend({ [SettingKey.POINTER_MODE]: 'joystick' });
    expect(new SettingsStore({ backend }).getPointerMode()).toBe('trackpad');
  });

  it('survives a backend that throws, which Foundry does before registration', () => {
    const backend: SettingsBackend = {
      register: vi.fn(),
      get: () => {
        throw new Error('not registered');
      },
      set: vi.fn(),
    };

    expect(new SettingsStore({ backend }).getBoolean(SettingKey.ENABLED)).toBe(true);
  });
});

describe('SettingsStore bar position', () => {
  it('round trips a position through JSON', () => {
    const { backend } = createBackend();
    const store = new SettingsStore({ backend });

    store.setBarPosition({ x: 120, y: 340 });
    expect(store.getBarPosition()).toEqual({ x: 120, y: 340 });
  });

  it('returns null when nothing has been stored', () => {
    const { backend } = createBackend();
    expect(new SettingsStore({ backend }).getBarPosition()).toBeNull();
  });

  it('returns null rather than throwing on a corrupt value', () => {
    const { backend } = createBackend({ [SettingKey.BAR_POSITION]: '{not json' });
    expect(new SettingsStore({ backend }).getBarPosition()).toBeNull();
  });

  it('returns null when the parsed value is the wrong shape', () => {
    const { backend } = createBackend({ [SettingKey.BAR_POSITION]: '{"x":"left","y":10}' });
    expect(new SettingsStore({ backend }).getBarPosition()).toBeNull();
  });
});

describe('SettingsStore change notification', () => {
  it('reports which setting changed, so it can be applied without a reload', () => {
    const changed: string[] = [];
    const { backend } = createBackend();
    new SettingsStore({ backend, onChanged: (key) => changed.push(key) }).registerAll();

    const calls = vi.mocked(backend.register).mock.calls;
    for (const [, , data] of calls) {
      (data.onChange as () => void)();
    }

    expect(changed).toEqual(SETTING_DEFINITIONS.map((definition) => definition.key));
  });
});
