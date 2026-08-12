import { beforeEach, describe, expect, it } from 'vitest';

import { VIRTUAL_POINTER_ID } from '../../src/constants.js';
import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';
import { TouchBinder } from '../../src/gesture/TouchBinder.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

/*
 * ⚠️ Suppressing native POINTER events is no longer the binder's job, and the cases that used to live
 * here have moved to `nativePointerSuppressor.test.ts`.
 *
 * It could never have worked from the document: PIXI binds `pointerup` on the WINDOW in the capture
 * phase, which fires first, so a document listener is always too late. The suppressor binds on the
 * window at Foundry's init, before PIXI exists, and its suite asserts against a listener registered
 * on the same node exactly as PIXI registers its own, which is a stronger check than this ever was.
 */
describe('TouchBinder native pointer suppression', () => {
  function dispatchNativePointer(pointerId: number, pointerType: string, target: Element): boolean {
    let reached = false;
    const listener = (): void => {
      reached = true;
    };
    document.body.addEventListener('pointerdown', listener);
    target.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId, pointerType })
    );
    document.body.removeEventListener('pointerdown', listener);
    return reached;
  }

  it('lets our own synthesised pointer through, identified by the reserved id', () => {
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: () => undefined,
      suppressNativeTouch: () => true,
      now: () => 0,
    });
    binder.bind();

    const board = document.createElement('canvas');
    document.body.append(board);

    expect(dispatchNativePointer(VIRTUAL_POINTER_ID, 'mouse', board)).toBe(true);
    binder.unbind();
  });

  it('leaves a real mouse alone, so a plugged in mouse still works', () => {
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: () => undefined,
      suppressNativeTouch: () => true,
      now: () => 0,
    });
    binder.bind();

    const board = document.createElement('canvas');
    document.body.append(board);

    expect(dispatchNativePointer(1, 'mouse', board)).toBe(true);
    binder.unbind();
  });

  it('suppresses nothing when the setting is off, so a conflicting module can take over', () => {
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: () => undefined,
      suppressNativeTouch: () => false,
      now: () => 0,
    });
    binder.bind();

    const board = document.createElement('canvas');
    document.body.append(board);

    expect(dispatchNativePointer(1, 'touch', board)).toBe(true);
    binder.unbind();
  });
});
