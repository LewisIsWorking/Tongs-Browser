import { describe, expect, it } from 'vitest';

import { SceneControlToggle } from '../../src/settings/SceneControlToggle.js';
import { captureHookRegistry } from './support/hookCapture.js';

/**
 * Binding and unbinding the scene control, which the injection suite never exercises. Written
 * 2026-08-31.
 *
 * ⚠️ `sceneControlToggle.test.ts` calls `inject` directly, so every question about the button's
 * CONTENT is answered and every question about whether it is ever ASKED FOR is not. That gap matters
 * more here than in most places: Foundry builds the scene controls exactly ONCE, and its own
 * `#prepareControls` says so - "This is only done once when the application is first rendered.
 * Subsequent renders reuse this data structure."
 *
 * A hook registered late has already missed the only call it will get. Measured on 14.365 before the
 * binding moved to `init`: the hook fired ZERO times for a listener added at `ready`, even after
 * `ui.controls.render({force: true})`, and the button simply never existed.
 *
 * COVERS: binding twice, unbinding with the wrong id, and `isBound` disagreeing with reality.
 * MISSES: that `main.ts` binds at `init` rather than `ready`. `mainEntryInit.test.ts` owns that.
 */
function toggle(): SceneControlToggle {
  return new SceneControlToggle({
    isActive: () => true,
    onToggle: () => undefined,
  });
}

describe('binding the scene control', () => {
  it('registers for the scene control hook', () => {
    const hooks = captureHookRegistry();

    toggle().bind();

    expect(hooks.registered.map((entry) => entry.hook)).toEqual(['getSceneControlButtons']);
  });

  it('reports that it is bound', () => {
    captureHookRegistry();
    const control = toggle();
    expect(control.isBound()).toBe(false);

    control.bind();

    expect(control.isBound()).toBe(true);
  });

  /**
   * ⚠️ Two listeners would each inject a tool, and `inject` replaces its own tool rather than adding
   * a second, so the visible result would be identical. The cost is silent: every scene control
   * render does the work twice, forever, with nothing to show for it and nothing to notice.
   */
  it('does not register a second time when already bound', () => {
    const hooks = captureHookRegistry();
    const control = toggle();

    control.bind();
    control.bind();

    expect(hooks.registered).toHaveLength(1);
  });
});

describe('unbinding the scene control', () => {
  /**
   * ⚠️ Asserts the ID as well as the hook name. `Hooks.off` needs the id it handed out, and passing
   * the wrong one silently leaves the listener installed: the caller believes it has unbound, the
   * hook keeps firing, and nothing anywhere reports a fault.
   */
  it('removes the hook it registered, by id', () => {
    const hooks = captureHookRegistry();
    const control = toggle();
    control.bind();
    const registered = hooks.registered[0];

    control.unbind();

    expect(hooks.removed).toEqual([{ hook: 'getSceneControlButtons', id: registered?.id }]);
  });

  it('reports that it is no longer bound', () => {
    captureHookRegistry();
    const control = toggle();
    control.bind();

    control.unbind();

    expect(control.isBound()).toBe(false);
  });

  /** ⚠️ Unbinding twice must not ask Foundry to remove a listener that is already gone. */
  it('does nothing when it was never bound', () => {
    const hooks = captureHookRegistry();

    toggle().unbind();

    expect(hooks.removed).toHaveLength(0);
  });

  it('can be bound again afterwards', () => {
    const hooks = captureHookRegistry();
    const control = toggle();
    control.bind();
    control.unbind();

    control.bind();

    expect(hooks.registered).toHaveLength(2);
    expect(control.isBound()).toBe(true);
  });
});
