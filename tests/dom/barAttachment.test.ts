import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BarAttachment } from '../../src/modifiers/BarAttachment.js';

/**
 * Putting the bar into the page and taking it out again.
 *
 * Small, but it owns the two moments that are easy to get wrong: when a clamp can first succeed, and
 * what must be released before the bar disappears.
 */
let element: HTMLDivElement;
let onLayoutAvailable: ReturnType<typeof vi.fn<() => void>>;
let onDetaching: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  document.body.innerHTML = '';
  element = document.createElement('div');
  onLayoutAvailable = vi.fn<() => void>();
  onDetaching = vi.fn<() => void>();
});

const make = () => new BarAttachment({ document, element, onLayoutAvailable, onDetaching });

describe('BarAttachment', () => {
  /**
   * ⚠️ The clamp runs AFTER the element is in the document, which is the first moment it has a size.
   *
   * A constructor clamp cannot possibly succeed: an element not in the DOM reports `offsetWidth` 0,
   * every position fits inside a width of zero, and the clamp is a no op BY CONSTRUCTION. So it
   * existed and only ever really ran on a drag. Measured on a 412px phone, the bar still opened
   * across the sidebar, because opening is not dragging.
   */
  it('clamps only once the element is in the document', () => {
    const attachment = make();

    attachment.attach();

    expect(element.parentElement).toBe(document.body);
    expect(onLayoutAvailable).toHaveBeenCalledOnce();
  });

  it('does nothing on a second attach', () => {
    const attachment = make();
    attachment.attach();
    attachment.attach();

    expect(onLayoutAvailable).toHaveBeenCalledOnce();
    expect(document.body.querySelectorAll('div')).toHaveLength(1);
  });

  /**
   * A rotation, or a sidebar that expands, changes the room available. A position that fitted a
   * moment ago can be off screen or over the sidebar now, and nothing else would notice.
   */
  it('re-clamps when the viewport changes', () => {
    make().attach();
    onLayoutAvailable.mockClear();

    window.dispatchEvent(new Event('resize'));

    expect(onLayoutAvailable).toHaveBeenCalledOnce();
  });

  it('stops listening for resizes once detached', () => {
    const attachment = make();
    attachment.attach();
    attachment.detach();
    onLayoutAvailable.mockClear();

    window.dispatchEvent(new Event('resize'));

    expect(onLayoutAvailable).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ Release anything held BEFORE disappearing, or Foundry is left believing shift is down with no
   * visible way for the user to clear it: the bar that would have shown it is gone.
   */
  it('releases held modifiers before it vanishes', () => {
    const attachment = make();
    attachment.attach();

    attachment.detach();

    expect(onDetaching).toHaveBeenCalledOnce();
    expect(element.parentElement).toBeNull();
    expect(attachment.isAttached()).toBe(false);
  });

  it('does nothing on a detach that has nothing to detach', () => {
    make().detach();

    expect(onDetaching).not.toHaveBeenCalled();
  });

  it('reports whether it is attached', () => {
    const attachment = make();

    expect(attachment.isAttached()).toBe(false);
    attachment.attach();
    expect(attachment.isAttached()).toBe(true);
  });

  /** An unattached element has no size to clamp against, so a reclamp then would be a no op. */
  it('reclamps only while attached', () => {
    const attachment = make();

    attachment.reclamp();
    expect(onLayoutAvailable).not.toHaveBeenCalled();

    attachment.attach();
    onLayoutAvailable.mockClear();
    attachment.reclamp();
    expect(onLayoutAvailable).toHaveBeenCalledOnce();
  });
});
