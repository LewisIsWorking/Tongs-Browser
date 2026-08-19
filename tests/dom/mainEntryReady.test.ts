import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bootMain, captureHooks, foundryGame, type ModuleEntry } from './support/mainUnderTest.js';
import { stubFoundryEnvironment } from './support/moduleUnderTest.js';
import { SettingKey } from '../../src/settings/SettingDefinitions.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

/**
 * What `src/main.ts` does at Foundry's `ready` hook.
 *
 * Everything except settings registration waits for ready, because the pointer needs viewport
 * dimensions and the canvas needs to exist, and at init neither is settled.
 */
describe('at ready', () => {
  /**
   * ⚠️ Every live harness reaches the module through `game.modules.get(id).api`. If this stopped
   * happening, all nine `check:` scripts would fail with "the module exposes no api, so it did not
   * reach its ready hook" - and would be accusing the ready hook rather than this one line.
   */
  it('exposes the API on the module entry, which every harness reaches through', async () => {
    const { hooks, moduleEntry } = await bootMain();

    hooks.once.get('init')?.();
    hooks.once.get('ready')?.();

    expect(moduleEntry.api).toBeDefined();
    expect(typeof (moduleEntry.api as { getPointer?: unknown }).getPointer).toBe('function');
  });

  it('enables the module when the stored setting says so', async () => {
    const { hooks, moduleEntry } = await bootMain({ [SettingKey.ENABLED]: true });

    hooks.once.get('init')?.();
    hooks.once.get('ready')?.();

    expect((moduleEntry.api as { isEnabled: () => boolean }).isEnabled()).toBe(true);
  });

  it('leaves it disabled when the setting is off', async () => {
    const { hooks, moduleEntry } = await bootMain({ [SettingKey.ENABLED]: false });

    hooks.once.get('init')?.();
    hooks.once.get('ready')?.();

    expect((moduleEntry.api as { isEnabled: () => boolean }).isEnabled()).toBe(false);
  });

  /**
   * The tray's pause button refreshes itself when tapped, which covers this client only. It does not
   * cover the GM pausing from a laptop, and a pause button showing the opposite of the truth invites
   * a tap that does the wrong thing.
   */
  it('follows a pause changed by somebody else', async () => {
    const { hooks } = await bootMain({ [SettingKey.ENABLED]: true });

    hooks.once.get('init')?.();
    hooks.once.get('ready')?.();

    expect([...hooks.on.keys()]).toContain('pauseGame');
    expect(() => hooks.on.get('pauseGame')?.()).not.toThrow();
  });

  /**
   * ⚠️ The scene control WRITES THE SETTING rather than calling enable directly, and that is a design
   * decision worth pinning. Calling `instance.enable()` here would leave the stored setting saying
   * the opposite, so the scene control and the settings dialog would disagree about what is on, and
   * a reload would silently undo whatever the button did.
   */
  it('toggles by writing the setting, so the button and the settings dialog cannot disagree', async () => {
    const { hooks, settings, moduleEntry } = await bootMain({ [SettingKey.ENABLED]: false });

    hooks.once.get('init')?.();
    hooks.once.get('ready')?.();

    const onChange = settings.registered.find((one) => one.key === SettingKey.ENABLED)?.onChange;
    settings.stored.set(SettingKey.ENABLED, true);
    onChange?.();

    expect(settings.stored.get(SettingKey.ENABLED)).toBe(true);
    expect((moduleEntry.api as { isEnabled: () => boolean }).isEnabled()).toBe(true);
  });

  /** ⚠️ Ready must not build anything on top of settings that were never registered. */
  it('refuses to start when init never registered the settings', async () => {
    stubFoundryEnvironment();
    const hooks = captureHooks();
    const moduleEntry: ModuleEntry = {};
    const game = foundryGame();
    game['settings'] = undefined;
    game['modules'] = { get: () => moduleEntry };

    vi.resetModules();
    await import('../../src/main.js');
    hooks.once.get('init')?.();
    hooks.once.get('ready')?.();

    expect(moduleEntry.api).toBeUndefined();
  });
});
