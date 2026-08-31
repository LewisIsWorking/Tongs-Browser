import { beforeEach, describe, expect, it } from 'vitest';

import { captureHookRegistry } from './support/hookCapture.js';
import { clampBinder, makeClampWindow } from './support/clampWindows.js';

/**
 * Binding to the render hooks, which is what makes any clamping actually happen. Written 2026-08-31.
 *
 * ⚠️ The clamping suite calls `clampAll` by hand. In a real session nothing does: Foundry renders a
 * window and the render HOOK is the only thing that notices. A binder that clamps perfectly and never
 * runs is indistinguishable from no binder at all, and on a phone that means a window opening off
 * screen with no way to reach it.
 *
 * COVERS: binding to the wrong hooks, binding twice, failing to unbind, and a window rendered after
 *   binding going unclamped.
 * MISSES: whether Foundry emits these hook names on the version in use. Only the live harness can
 *   answer that, and `check:android` does.
 */
const captureHooks = captureHookRegistry;

const offscreen = (): HTMLElement =>
  makeClampWindow('application', { left: 350, top: 10, width: 300, height: 200 });

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('binding to the render hooks', () => {
  /**
   * ⚠️ BOTH generations, for the same reason the selector list covers both: Foundry has two
   * application systems live at once and a real PF2e session has windows from each on screen.
   * Binding one leaves half of them unreachable, and which half depends on the modules loaded.
   */
  it('registers for both application generations', () => {
    const hooks = captureHooks();

    clampBinder().bind();

    expect(hooks.registered.map((entry) => entry.hook)).toEqual([
      'renderApplication',
      'renderApplicationV2',
    ]);
  });

  it('clamps whatever is already on screen at the moment it binds', () => {
    captureHooks();
    const element = offscreen();

    clampBinder().bind();

    expect(element.style.left).toBe('100px');
  });

  /** ⚠️ The point of the class: a window Foundry renders LATER still gets clamped. */
  it('clamps a window that renders after binding', () => {
    const hooks = captureHooks();
    clampBinder().bind();
    const element = offscreen();

    hooks.registered[0]?.callback();

    expect(element.style.left).toBe('100px');
  });

  it('clamps from the second generation hook as well as the first', () => {
    const hooks = captureHooks();
    clampBinder().bind();
    const element = offscreen();

    hooks.registered[1]?.callback();

    expect(element.style.left).toBe('100px');
  });

  /**
   * ⚠️ Binding twice would leave two listeners per hook. Harmless only if clamping is idempotent,
   * and it is not obliged to be: the second pass measures a rect the first pass just moved. That is
   * the shape that turns a correct clamp into a window that walks across the screen on every render.
   */
  it('does not register a second time when already bound', () => {
    const hooks = captureHooks();
    const bound = clampBinder();

    bound.bind();
    bound.bind();

    expect(hooks.registered).toHaveLength(2);
  });

  it('reports whether it is bound', () => {
    captureHooks();
    const bound = clampBinder();
    expect(bound.isBound()).toBe(false);

    bound.bind();
    expect(bound.isBound()).toBe(true);

    bound.unbind();
    expect(bound.isBound()).toBe(false);
  });

  it('removes both hooks when unbound', () => {
    const hooks = captureHooks();
    const bound = clampBinder();
    bound.bind();

    bound.unbind();

    expect(hooks.removed.map((entry) => entry.hook)).toEqual([
      'renderApplication',
      'renderApplicationV2',
    ]);
  });

  /** ⚠️ The guard is on `hookIds` being empty, so unbinding has to clear it or rebinding is a no-op. */
  it('can be bound again after being unbound', () => {
    const hooks = captureHooks();
    const bound = clampBinder();
    bound.bind();
    bound.unbind();

    bound.bind();

    expect(hooks.registered).toHaveLength(4);
    expect(bound.isBound()).toBe(true);
  });
});
