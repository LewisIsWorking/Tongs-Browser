import { describe, expect, it } from 'vitest';

import { VIRTUAL_POINTER_ID } from '../../src/constants.js';

/**
 * These are capability tests for the test environment itself, not for module code.
 *
 * The entire pointer engine rests on jsdom carrying synthesised PointerEvent fields faithfully. If
 * that assumption is wrong, every dispatch test written on later branches would pass while proving
 * nothing. Establishing it once, here, is cheaper than discovering it halfway through the pointer
 * core. These tests are expected to fail loudly on a jsdom upgrade that regresses event fidelity.
 */
describe('jsdom PointerEvent fidelity', () => {
  it('constructs a PointerEvent carrying every field the pointer engine sets', () => {
    // No view here on purpose. See the environment limitations block at the bottom of this file.
    const event = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: VIRTUAL_POINTER_ID,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: 120,
      clientY: 240,
      screenX: 120,
      screenY: 240,
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });

    expect(event.type).toBe('pointerdown');
    expect(event.bubbles).toBe(true);
    expect(event.cancelable).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.pointerId).toBe(VIRTUAL_POINTER_ID);
    expect(event.pointerType).toBe('mouse');
    expect(event.isPrimary).toBe(true);
    expect(event.button).toBe(0);
    expect(event.buttons).toBe(1);
    expect(event.clientX).toBe(120);
    expect(event.clientY).toBe(240);
    expect(event.ctrlKey).toBe(true);
    expect(event.shiftKey).toBe(false);
  });

  it('preserves the buttons bitmask through a dispatched move, which is what makes dragging work', () => {
    const target = document.createElement('div');
    document.body.append(target);

    const observed: number[] = [];
    target.addEventListener('pointermove', (event) => {
      observed.push(event.buttons);
    });

    for (const clientX of [10, 20, 30]) {
      target.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: VIRTUAL_POINTER_ID,
          pointerType: 'mouse',
          isPrimary: true,
          button: -1,
          buttons: 1,
          clientX,
          clientY: 50,
        })
      );
    }

    expect(observed).toEqual([1, 1, 1]);
    target.remove();
  });

  it('bubbles a synthesised pointer event up to document, so delegated listeners see it', () => {
    const parent = document.createElement('section');
    const child = document.createElement('button');
    parent.append(child);
    document.body.append(parent);

    let seenOnDocument = false;
    const listener = (): void => {
      seenOnDocument = true;
    };
    document.addEventListener('pointerdown', listener);

    child.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: VIRTUAL_POINTER_ID,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: 1,
      })
    );

    expect(seenOnDocument).toBe(true);

    document.removeEventListener('pointerdown', listener);
    parent.remove();
  });

  it('reports a cancelable contextmenu event as cancelled when a listener preventDefaults it', () => {
    const target = document.createElement('div');
    document.body.append(target);
    target.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 2,
      buttons: 0,
    });
    const notCancelled = target.dispatchEvent(event);

    expect(notCancelled).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    target.remove();
  });
});

/**
 * jsdom has no layout engine, so document.elementFromPoint does not exist. This is not a bug to work
 * around, it is a design constraint: HitTester must receive its hit test function by injection
 * rather than reaching for document directly, otherwise it cannot be tested at all. This test pins
 * that constraint in place so the dependency is not quietly removed later.
 */
describe('jsdom environment limitations', () => {
  it('has no elementFromPoint, so hit testing must be an injected dependency', () => {
    const hitTest = (document as Partial<Document>).elementFromPoint;
    expect(hitTest).toBeUndefined();
  });

  /**
   * Vitest exposes jsdom's globals on a plain object rather than handing over the branded Window
   * instance, so the UIEvent constructor rejects it: "member view is not of type Window". Passing
   * document.defaultView instead makes no difference, they are the same object here.
   *
   * Consequence for the pointer core: the dispatcher must take its window reference by injection
   * and tolerate it being absent, rather than reading the window global directly. Real browsers
   * accept view: window without complaint, so this is a test environment constraint only, but it
   * is one the production code has to be shaped around.
   */
  it('does not expose a branded Window, so event view cannot be set under test', () => {
    expect(window).toBe(document.defaultView);
    expect(window.constructor.name).toBe('Object');
    expect(() => new PointerEvent('pointerdown', { view: window })).toThrow(/not of type Window/);
  });
});
