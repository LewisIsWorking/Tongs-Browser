import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bootMain, captureHooks, foundryGame } from './support/mainUnderTest.js';
import { stubFoundryEnvironment } from './support/moduleUnderTest.js';
import { SettingKey } from '../../src/settings/SettingDefinitions.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

/**
 * What `src/main.ts` does at Foundry's `init` hook.
 *
 * ⚠️ `main.ts` was at 0% coverage until 2026-08-18, and it is the file that decides whether the
 * module loads at all. Every failure it can have is silent and total: no settings, no scene control,
 * no API, and a console that says nothing unusual.
 */
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
