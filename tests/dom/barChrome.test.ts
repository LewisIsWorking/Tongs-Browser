import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildBarChrome, type BarChromeHandlers } from '../../src/modifiers/BarChrome.js';

/**
 * The bar's own furniture: its root, its drag handle and its collapse button.
 */
let handlers: {
  onHandlePointerDown: ReturnType<typeof vi.fn>;
  onHandlePointerMove: ReturnType<typeof vi.fn>;
  onHandlePointerUp: ReturnType<typeof vi.fn>;
  onCollapseToggled: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  document.body.innerHTML = '';
  handlers = {
    onHandlePointerDown: vi.fn(),
    onHandlePointerMove: vi.fn(),
    onHandlePointerUp: vi.fn(),
    onCollapseToggled: vi.fn(),
  };
});

const build = () => buildBarChrome(document, handlers as unknown as BarChromeHandlers);

describe('buildBarChrome', () => {
  /**
   * ⚠️ The one line here that is load bearing, and without it the bar cannot work at all.
   *
   * Every touch on the page is routed through the virtual pointer, so a tap on a modifier key would
   * become a pointer event delivered wherever the pointer happens to be. The key would modify a
   * click somewhere else on the map rather than latching, which is the exact opposite of its job.
   */
  it('marks the bar so the gesture layer leaves it alone', () => {
    expect(build().root.getAttribute('data-tongs-browser')).toBe('ignore');
  });

  it('builds a handle that reports presses and movement', () => {
    const { root } = build();
    const handle = root.querySelector('.tb-modifier-bar__handle');

    handle?.dispatchEvent(new PointerEvent('pointerdown'));
    handle?.dispatchEvent(new PointerEvent('pointermove'));

    expect(handlers.onHandlePointerDown).toHaveBeenCalledOnce();
    expect(handlers.onHandlePointerMove).toHaveBeenCalledOnce();
  });

  /**
   * ⚠️ pointercancel goes to the SAME handler as pointerup. The browser cancels a pointer whenever
   * it takes the gesture over, and a bar that never hears about it is left believing a finger is
   * still down: the next unrelated move drags it across the screen.
   */
  it('treats a cancelled pointer exactly like a released one', () => {
    const handle = build().root.querySelector('.tb-modifier-bar__handle');

    handle?.dispatchEvent(new PointerEvent('pointerup'));
    handle?.dispatchEvent(new PointerEvent('pointercancel'));

    expect(handlers.onHandlePointerUp).toHaveBeenCalledTimes(2);
  });

  it('gives the handle a title, since a bare grip says nothing', () => {
    expect(build().root.querySelector<HTMLElement>('.tb-modifier-bar__handle')?.title).toBe(
      'Drag to move'
    );
  });

  describe('the collapse button', () => {
    it('reports a tap', () => {
      build().root.querySelector<HTMLButtonElement>('.tb-modifier-bar__collapse')?.click();

      expect(handlers.onCollapseToggled).toHaveBeenCalledOnce();
    });

    /** A glyph has no accessible name of its own, and the caret reads as nothing to a screen reader. */
    it('has an accessible name, which its glyph cannot provide', () => {
      const button = build().root.querySelector('.tb-modifier-bar__collapse');

      expect(button?.textContent).toBe('<');
      expect(button?.getAttribute('aria-label')).toBe('Collapse modifier bar');
    });

    it('is a real button rather than a submit', () => {
      const button = build().root.querySelector<HTMLButtonElement>('.tb-modifier-bar__collapse');

      expect(button?.tagName).toBe('BUTTON');
      expect(button?.type).toBe('button');
    });
  });

  it('returns a keys container that is not yet attached, so the bar decides where it goes', () => {
    const { root, keysContainer } = build();

    expect(keysContainer.parentElement).toBeNull();
    expect(root.contains(keysContainer)).toBe(false);
  });
});
