import { describe, expect, it, vi } from 'vitest';

import { SettingKey } from '../../src/settings/SettingDefinitions.js';
import { SettingsStore, type SettingsBackend } from '../../src/settings/SettingsStore.js';

/**
 * Runtime defaults, added 2026-09-07 so `Enabled` can start OFF on a desktop.
 *
 * ⛔ THE FAILURE THIS FILE EXISTS FOR is not "the override is ignored", which any test would catch.
 * It is the override being honoured by ONE of the two paths. `SettingsStore`'s own opening paragraph
 * says a default disagreeing between the register call and the read path is the classic settings
 * bug, and this change adds a second source of defaults to a file built around avoiding exactly
 * that. Registered `false` while the read path falls back to `true` gives a module that behaves as
 * enabled while its settings screen says it is not, and nothing in the UI contradicts either half.
 */
function createBackend(values: Record<string, unknown> = {}) {
  const registered = new Map<string, { default?: unknown }>();
  const store = new Map<string, unknown>(Object.entries(values));
  const backend: SettingsBackend = {
    register: vi.fn((_namespace: string, key: string, data: { default?: unknown }) => {
      registered.set(key, data);
    }),
    get: (_namespace, key) => store.get(key),
    set: (_namespace, key, value) => {
      store.set(key, value);
      return undefined;
    },
  };
  return { backend, registered };
}

describe('a runtime default', () => {
  it('is what Foundry gets at registration', () => {
    const { backend, registered } = createBackend();

    new SettingsStore({ backend, defaults: { [SettingKey.ENABLED]: false } }).registerAll();

    expect(registered.get(SettingKey.ENABLED)?.default).toBe(false);
  });

  it('is also what the read path falls back to when nothing is stored', () => {
    const { backend } = createBackend();
    const store = new SettingsStore({ backend, defaults: { [SettingKey.ENABLED]: false } });

    expect(store.getBoolean(SettingKey.ENABLED)).toBe(false);
  });

  /** ⛔ The two halves, asserted against EACH OTHER rather than each against a constant. */
  it('is the same value in both places, which is the whole point', () => {
    for (const wanted of [true, false]) {
      const { backend, registered } = createBackend();
      const store = new SettingsStore({ backend, defaults: { [SettingKey.ENABLED]: wanted } });
      store.registerAll();

      expect(registered.get(SettingKey.ENABLED)?.default).toBe(
        store.getBoolean(SettingKey.ENABLED)
      );
    }
  });
});

describe('what a runtime default must not disturb', () => {
  /** ⚠️ A stored value always wins. This decides only what happens before the user has an opinion. */
  it('is ignored once the user has stored anything', () => {
    const { backend } = createBackend({ [SettingKey.ENABLED]: true });
    const store = new SettingsStore({ backend, defaults: { [SettingKey.ENABLED]: false } });

    expect(store.getBoolean(SettingKey.ENABLED)).toBe(true);
  });

  it('leaves every setting it does not name at its written default', () => {
    const { backend, registered } = createBackend();

    new SettingsStore({ backend, defaults: { [SettingKey.ENABLED]: false } }).registerAll();

    expect(registered.get(SettingKey.HAPTICS)?.default).toBe(true);
    expect(registered.get(SettingKey.UI_SCALE)?.default).toBe(0.75);
  });

  /** ⚠️ No override at all must behave exactly as before, or this change broke every existing client. */
  it('leaves the written default alone when no override is given', () => {
    const { backend, registered } = createBackend();
    const store = new SettingsStore({ backend });
    store.registerAll();

    expect(registered.get(SettingKey.ENABLED)?.default).toBe(true);
    expect(store.getBoolean(SettingKey.ENABLED)).toBe(true);
  });
});
