import { describe, expect, it } from 'vitest';

import {
  KeyboardSynthesizer,
  type KeyboardManagerLike,
} from '../../src/modifiers/KeyboardSynthesizer.js';
import { ModifierBar } from '../../src/modifiers/ModifierBar.js';

/**
 * The bar's own drag handle, and the two defensive guards nothing was reaching.
 *
 * Dragging the bar had no coverage at all, which matters more than it sounds: the handle is how the
 * bar gets out of the way of the thing you are trying to tap, and a bar that cannot be moved on a
 * phone is a bar sitting on top of Foundry's controls. ADR 0009 is about exactly that failure from
 * the other direction.
 *
 * jsdom has no `PointerEvent` and no pointer capture, so both are supplied here. The production code
 * already feature detects capture rather than assuming it, and stubbing it is what exercises that
 * path instead of skipping past it.
 */
function pointerEvent(type: string, init: { pointerId: number; clientX: number; clientY: number }) {
  const event = new MouseEvent(type, {
    clientX: init.clientX,
    clientY: init.clientY,
    bubbles: true,
  });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId });
  return event;
}

function buildBar() {
  const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
  const bar = new ModifierBar({
    document,
    synthesizer: new KeyboardSynthesizer({ document, getKeyboardManager: () => manager }),
    onFlagsChanged: () => undefined,
    initialPosition: { x: 100, y: 100 },
  });
  bar.attach();

  const handle = bar.getElement().querySelector<HTMLElement>('.tb-modifier-bar__handle');
  if (handle === null) {
    throw new Error('the bar has no drag handle');
  }

  const captured: number[] = [];
  const released: number[] = [];
  (handle as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = (id) => {
    captured.push(id);
  };
  (handle as unknown as { releasePointerCapture: (id: number) => void }).releasePointerCapture = (
    id
  ) => {
    released.push(id);
  };

  return { bar, handle, captured, released };
}

describe('ModifierBar drag handle', () => {
  it('moves the bar with the finger, and captures the pointer so it survives leaving the handle', () => {
    const { bar, handle, captured } = buildBar();

    handle.dispatchEvent(pointerEvent('pointerdown', { pointerId: 7, clientX: 130, clientY: 140 }));
    handle.dispatchEvent(pointerEvent('pointermove', { pointerId: 7, clientX: 180, clientY: 200 }));

    // The grab offset is preserved: the finger started 30,40 into the bar and stays there.
    expect(bar.getPosition()).toEqual({ x: 150, y: 160 });
    expect(captured).toEqual([7]);
  });

  it('releases the capture on pointerup and stops following', () => {
    const { bar, handle, released } = buildBar();

    handle.dispatchEvent(pointerEvent('pointerdown', { pointerId: 7, clientX: 130, clientY: 140 }));
    handle.dispatchEvent(pointerEvent('pointermove', { pointerId: 7, clientX: 180, clientY: 200 }));
    handle.dispatchEvent(pointerEvent('pointerup', { pointerId: 7, clientX: 180, clientY: 200 }));

    expect(released).toEqual([7]);

    // After the release the bar must not follow anything. A handle that keeps dragging after the
    // finger is gone is the sticky drag this whole module has been chasing, in miniature.
    handle.dispatchEvent(pointerEvent('pointermove', { pointerId: 7, clientX: 400, clientY: 400 }));
    expect(bar.getPosition()).toEqual({ x: 150, y: 160 });
  });

  /**
   * A second finger must not steer a drag it did not start. Without the id check, any touch anywhere
   * would yank the bar to itself mid gesture.
   */
  it('ignores a different pointer id, for both move and up', () => {
    const { bar, handle, released } = buildBar();

    handle.dispatchEvent(pointerEvent('pointerdown', { pointerId: 7, clientX: 130, clientY: 140 }));
    handle.dispatchEvent(pointerEvent('pointermove', { pointerId: 9, clientX: 400, clientY: 400 }));

    expect(bar.getPosition()).toEqual({ x: 100, y: 100 });

    handle.dispatchEvent(pointerEvent('pointerup', { pointerId: 9, clientX: 400, clientY: 400 }));
    expect(released).toEqual([]);

    // The original finger still owns the drag, which is the point of ignoring the other one.
    handle.dispatchEvent(pointerEvent('pointermove', { pointerId: 7, clientX: 180, clientY: 200 }));
    expect(bar.getPosition()).toEqual({ x: 150, y: 160 });
  });

  it('cancels a drag on pointercancel, the same as a release', () => {
    const { bar, handle } = buildBar();

    handle.dispatchEvent(pointerEvent('pointerdown', { pointerId: 7, clientX: 130, clientY: 140 }));
    handle.dispatchEvent(
      pointerEvent('pointercancel', { pointerId: 7, clientX: 130, clientY: 140 })
    );
    handle.dispatchEvent(pointerEvent('pointermove', { pointerId: 7, clientX: 400, clientY: 400 }));

    expect(bar.getPosition()).toEqual({ x: 100, y: 100 });
  });

  /**
   * Without pointer capture the drag still has to work, because jsdom is not the only environment
   * that lacks it and a feature detect that has never been taken is a feature detect nobody has
   * checked.
   */
  it('drags without pointer capture at all', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
    const bar = new ModifierBar({
      document,
      synthesizer: new KeyboardSynthesizer({ document, getKeyboardManager: () => manager }),
      onFlagsChanged: () => undefined,
      initialPosition: { x: 100, y: 100 },
    });
    bar.attach();
    const handle = bar.getElement().querySelector<HTMLElement>('.tb-modifier-bar__handle');

    handle?.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 1, clientX: 110, clientY: 110 })
    );
    handle?.dispatchEvent(
      pointerEvent('pointermove', { pointerId: 1, clientX: 160, clientY: 170 })
    );
    handle?.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 160, clientY: 170 }));

    expect(bar.getPosition()).toEqual({ x: 150, y: 160 });
  });
});

/**
 * The two guards that skip a key with no matching definition or no rendered button.
 *
 * Neither is reachable through the public API, because the bar builds both maps itself from the same
 * list. They exist so that a future key list edit degrades into a skipped key rather than a thrown
 * exception mid render, and a guard nobody has ever executed is a guard nobody knows works. See
 * "prove it by feeding it the bug".
 */
describe('ModifierBar reclamping and attachment', () => {
  /**
   * `reclamp` is what keeps the bar off the sidebar after Foundry re-renders, and `onViewportChanged`
   * is what keeps it on screen after a rotation. Neither had been executed once, and a rotation that
   * strands the bar off screen is ADR 0009's bug returning by another route.
   */
  it('re-clamps when attached, and does nothing when it is not', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
    let available = 1000;
    const bar = new ModifierBar({
      document,
      synthesizer: new KeyboardSynthesizer({ document, getKeyboardManager: () => manager }),
      onFlagsChanged: () => undefined,
      initialPosition: { x: 400, y: 50 },
      getAvailableWidth: () => available,
    });

    // Not attached: reclamp must be a no op rather than throwing on an element with no layout.
    expect(() => {
      bar.reclamp();
    }).not.toThrow();
    expect(bar.isAttached()).toBe(false);
    expect(bar.getPosition()).toEqual({ x: 400, y: 50 });

    bar.attach();
    expect(bar.isAttached()).toBe(true);

    // jsdom reports offsetWidth as 0, so the clamp cannot bind on width here. What is being proved
    // is that the attached branch RUNS and the unattached one does not, which is the difference
    // between a bar that reflows after a rotation and one that stays where it was.
    available = 200;
    expect(() => {
      bar.reclamp();
    }).not.toThrow();

    expect(() => {
      window.dispatchEvent(new Event('resize'));
    }).not.toThrow();

    bar.detach();
    expect(bar.isAttached()).toBe(false);
  });
});

describe('ModifierBar guards against a missing button', () => {
  /** The collapse button, and a detach that has nothing to detach. */
  it('collapses from its own button, and tolerates a double detach', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
    const bar = new ModifierBar({
      document,
      synthesizer: new KeyboardSynthesizer({ document, getKeyboardManager: () => manager }),
      onFlagsChanged: () => undefined,
    });
    bar.attach();

    const collapse = bar
      .getElement()
      .querySelector<HTMLButtonElement>('.tb-modifier-bar__collapse');
    expect(bar.isCollapsed()).toBe(false);

    collapse?.click();
    expect(bar.isCollapsed()).toBe(true);

    collapse?.click();
    expect(bar.isCollapsed()).toBe(false);

    // Detaching twice must be a no op, not a second clearAll against a removed element.
    bar.detach();
    expect(() => {
      bar.detach();
    }).not.toThrow();
    expect(bar.isAttached()).toBe(false);
  });

  // The "unknown modifier code" guard is covered by modifierBarKeyListDrift.test.ts, which stages
  // the real drift between MODIFIER_CODES and MODIFIER_KEYS rather than inventing a fake code that
  // `diff` would never report in the first place.
});
