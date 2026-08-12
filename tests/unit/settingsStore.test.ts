import { describe, expect, it, vi } from 'vitest';

import { SETTING_DEFINITIONS, SettingKey } from '../../src/settings/SettingDefinitions.js';
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
