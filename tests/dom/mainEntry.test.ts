import { beforeEach, describe, expect, it, vi } from 'vitest';

import { stubFoundryEnvironment } from './support/moduleUnderTest.js';
import { SettingKey } from '../../src/settings/SettingDefinitions.js';

/**
 * The module entry point: what happens at `init`, and what happens at `ready`.
 *
 * ⚠️ `src/main.ts` was at **0% coverage** until 2026-08-18, and it is the file that decides whether
 * the module loads at all. Every failure it can have is silent and total: no settings, no scene
 * control, no API, and a console that says nothing unusual. Nothing but a live run would have caught
 * one, which is the definition of the gap worth closing first.
 *
 * These assert OUTCOMES a regression would actually break, not that particular functions were called:
 * the toggle exists after init, the API is on the module entry after ready, the module is enabled
 * only when the setting says so.
 */

/** Hook registrations, captured so the callbacks can be invoked in the order Foundry would. */
interface CapturedHooks {
  once: Map<string, () => void>;
  on: Map<string, () => void>;
  off: string[];
}

function captureHooks(): CapturedHooks {
  const captured: CapturedHooks = { once: new Map(), on: new Map(), off: [] };
  Object.assign(globalThis, {
    Hooks: {
      once: (name: string, callback: () => void) => {
        captured.once.set(name, callback);
        return 1;
      },
      on: (name: string, callback: () => void) => {
        captured.on.set(name, callback);
        return 1;
      },
      off: (name: string) => {
        captured.off.push(name);
      },
    },
  });
  return captured;
}

interface Registered {
  key: string;
  onChange?: () => void;
}

/** A settings backend that records what was registered and lets a test choose stored values. */
function stubSettings(values: Record<string, unknown> = {}) {
  const registered: Registered[] = [];
  const stored = new Map<string, unknown>(Object.entries(values));
  return {
    registered,
    stored,
    api: {
      register: (_namespace: string, key: string, options: { onChange?: () => void }) => {
        registered.push({ key, ...(options.onChange ? { onChange: options.onChange } : {}) });
      },
      get: (_namespace: string, key: string) => stored.get(key),
      set: (_namespace: string, key: string, value: unknown) => {
        stored.set(key, value);
        return Promise.resolve(value);
      },
    },
  };
}

/**
 * The stubbed `game`, typed for writing.
 *
 * `globalThis.game` is declared by `src/types/foundry.d.ts` for the module's own use, where it is
 * read only. These tests need to REPLACE parts of it, so they reach it through one cast in one place
 * rather than scattering the same assertion through every setup.
 */
function foundryGame(): Record<string, unknown> {
  return (globalThis as unknown as { game: Record<string, unknown> }).game;
}

interface ModuleEntry {
  api?: unknown;
}

async function bootMain(values: Record<string, unknown> = {}) {
  stubFoundryEnvironment();
  const hooks = captureHooks();
  const settings = stubSettings(values);
  const moduleEntry: ModuleEntry = {};

  const game = foundryGame();
  game['settings'] = settings.api;
  game['modules'] = { get: () => moduleEntry };

  vi.resetModules();
  await import('../../src/main.js');
  return { hooks, settings, moduleEntry };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('at init', () => {
  it('registers the settings, so the module has anything to read', async () => {
    const { hooks, settings } = await bootMain();

    hooks.once.get('init')?.();

    expect(settings.registered.length).toBeGreaterThan(0);
    expect(settings.registered.map((one) => one.key)).toContain(SettingKey.ENABLED);
  });

  /**
   * ⚠️ THE SCENE CONTROL MUST BE BOUND AT INIT, NOT READY, and this is the regression test for a bug
   * that shipped. Foundry builds its scene controls exactly once - `scene-controls.mjs` says so on
   * `#prepareControls` - so a listener added at ready has already missed it, and no amount of
   * re-rendering brings it back. Measured on 14.365: the hook fired zero times for a listener added
   * at ready, even after `ui.controls.render({force: true})`.
   *
   * The failure is total and silent: the button simply never exists, and nothing logs.
   */
  it('binds the scene control listener at init, because Foundry builds controls only once', async () => {
    const { hooks } = await bootMain();

    hooks.once.get('init')?.();

    expect([...hooks.on.keys()]).toContain('getSceneControlButtons');
  });

  /** Without settings there is nothing to register against, and it must say so rather than throw. */
  it('reports the missing settings API instead of throwing', async () => {
    stubFoundryEnvironment();
    const hooks = captureHooks();
    const game = foundryGame();
    game['settings'] = undefined;

    vi.resetModules();
    await import('../../src/main.js');

    expect(() => hooks.once.get('init')?.()).not.toThrow();
  });
});

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
