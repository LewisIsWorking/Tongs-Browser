import { describe, expect, it } from 'vitest';

import { CursorOverlay } from './support/pointerHarness.js';

describe('CursorOverlay', () => {
  /**
   * Load bearing, not cosmetic. If the cursor were hit testable, elementFromPoint would resolve to
   * the cursor itself and nothing underneath it would ever receive an event.
   */
  it('is not hit testable, so it can never resolve as its own hit target', () => {
    const cursor = new CursorOverlay({ document });
    cursor.attach();

    expect(cursor.getElement().style.pointerEvents).toBe('none');
  });

  it('attaches outside Foundry interface subtree so it survives re-renders', () => {
    const cursor = new CursorOverlay({ document });
    cursor.attach();

    expect(cursor.getElement().parentElement).toBe(document.body);
    expect(cursor.isAttached()).toBe(true);
  });

  it('is idempotent on repeated attach and detach', () => {
    const cursor = new CursorOverlay({ document });
    cursor.attach();
    cursor.attach();

    expect(document.querySelectorAll('.tb-cursor')).toHaveLength(1);

    cursor.detach();
    cursor.detach();
    expect(document.querySelectorAll('.tb-cursor')).toHaveLength(0);
  });

  it('moves with a compositor friendly transform rather than layout properties', () => {
    const cursor = new CursorOverlay({ document });
    cursor.moveTo({ clientX: 120, clientY: 240 });

    expect(cursor.getElement().style.transform).toBe('translate3d(120px, 240px, 0)');
  });

  it('marks the held state so a drag is never ambiguous to the user', () => {
    const cursor = new CursorOverlay({ document });
    cursor.setButtonHeld(true);
    expect(cursor.getElement().classList.contains('tb-cursor--held')).toBe(true);

    cursor.setButtonHeld(false);
    expect(cursor.getElement().classList.contains('tb-cursor--held')).toBe(false);
  });

  /**
   * ⚠️ Hiding is how the cursor leaves the screen without the overlay being torn down and rebuilt.
   * The element keeps its position and held state, so re-showing it does not make the pointer jump
   * to a stale coordinate. Removing the element instead would be the obvious alternative and would
   * lose exactly that.
   */
  it('hides and shows without being rebuilt', () => {
    const overlay = new CursorOverlay({ document });
    const element = overlay.getElement();

    overlay.setVisible(false);
    expect(element.style.display).toBe('none');

    overlay.setVisible(true);
    expect(element.style.display).toBe('');
    expect(overlay.getElement()).toBe(element);
  });

  /** The document it was built against, which the debug overlay needs to attach beside it. */
  it('reports the document it was given', () => {
    expect(new CursorOverlay({ document }).getDocument()).toBe(document);
  });
});
