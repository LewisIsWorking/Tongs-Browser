import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DebugOverlay } from '../../src/debug/DebugOverlay.js';
import type { EventDescriptor } from '../../src/pointer/EventDescriptor.js';

/**
 * The outline that says which element the pointer actually resolved to.
 *
 * It exists because the failure it diagnoses is invisible: when a tap does nothing there is no way to
 * tell from the screen whether the pointer resolved the wrong element, resolved the right one and the
 * event was ignored, or never dispatched at all.
 *
 * ⚠️ Which makes it a probe, and a probe that changes what it measures is worthless. Everything below
 * is about that: it must not be hit testable, it must draw nothing while disabled, and it must never
 * leave a stale rectangle pointing at an element the pointer has since left.
 */
function stubLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setDebugEnabled: vi.fn() };
}

function build() {
  const logger = stubLogger();
  return { logger, overlay: new DebugOverlay({ document, logger: logger as never }) };
}

const descriptorAt = (clientX: number, clientY: number): EventDescriptor =>
  ({ kind: 'pointer', type: 'pointerdown', position: { clientX, clientY } }) as EventDescriptor;

function boxed(width: number, height: number, left = 10, top = 20): HTMLElement {
  const element = document.createElement('div');
  document.body.append(element);
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left, top, width, height, right: left + width, bottom: top + height }),
  });
  return element;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

/**
 * ⚠️ THE OUTLINE MUST NOT BE HIT TESTABLE. If it were, it would become the answer to every hit test
 * the moment it was drawn, so the pointer would start resolving to the diagnostic instead of to the
 * board, and the thing being diagnosed would stop working WHILE being diagnosed.
 */
describe('the outline itself', () => {
  it('is not hit testable, so it cannot become the answer to every hit test', () => {
    const { overlay } = build();

    expect(overlay.getElement().style.pointerEvents).toBe('none');
  });

  it('is hidden from assistive technology, being pure decoration', () => {
    const { overlay } = build();

    expect(overlay.getElement().getAttribute('aria-hidden')).toBe('true');
  });

  it('starts hidden and detached', () => {
    const { overlay } = build();

    expect(overlay.getElement().style.display).toBe('none');
    expect(document.body.contains(overlay.getElement())).toBe(false);
    expect(overlay.isEnabled()).toBe(false);
  });
});

describe('turning it on and off', () => {
  it('attaches the outline and turns debug logging on together', () => {
    const { overlay, logger } = build();

    overlay.setEnabled(true);

    expect(document.body.contains(overlay.getElement())).toBe(true);
    expect(logger.setDebugEnabled).toHaveBeenCalledWith(true);
  });

  it('removes the outline from the document again when switched off', () => {
    const { overlay, logger } = build();
    overlay.setEnabled(true);

    overlay.setEnabled(false);

    expect(document.body.contains(overlay.getElement())).toBe(false);
    expect(logger.setDebugEnabled).toHaveBeenLastCalledWith(false);
  });

  /*
   * ⚠️ THERE IS NO TEST HERE FOR "enabling twice does not attach two outlines", and its absence is
   * deliberate. One was written and then removed, because mutation checking showed it PASSED with the
   * `attached` guard deleted: `append` moves an element that is already in the document rather than
   * duplicating it, so a second outline is impossible whatever the flag does.
   *
   * A test that cannot fail still counts, still runs, and still reads like protection. Keeping it
   * would have overstated what is covered here.
   */

  it('tolerates being switched off before it was ever on', () => {
    const { overlay } = build();

    expect(() => {
      overlay.setEnabled(false);
    }).not.toThrow();
  });
});

describe('while it is switched off', () => {
  /** A disabled probe that still draws is a probe that is never really off. */
  it('draws nothing and logs nothing for a dispatched event', () => {
    const { overlay, logger } = build();
    const target = boxed(50, 40);

    overlay.onDispatch(descriptorAt(5, 6), target);

    expect(logger.debug).not.toHaveBeenCalled();
    expect(overlay.getElement().style.display).toBe('none');
  });
});

describe('while it is switched on', () => {
  it('draws the outline over the element the event actually reached', () => {
    const { overlay } = build();
    overlay.setEnabled(true);
    const target = boxed(50, 40, 10, 20);

    overlay.onDispatch(descriptorAt(5, 6), target);

    const style = overlay.getElement().style;
    expect(style.display).not.toBe('none');
    expect(style.left).toBe('10px');
    expect(style.top).toBe('20px');
    expect(style.width).toBe('50px');
    expect(style.height).toBe('40px');
  });

  it('logs where the event went and what it landed on', () => {
    const { overlay, logger } = build();
    overlay.setEnabled(true);
    const target = boxed(50, 40);
    target.id = 'board';
    target.className = 'canvas layer';

    overlay.onDispatch(descriptorAt(120, 340), target);

    const line = String(logger.debug.mock.calls[0]?.[0]);
    expect(line).toContain('120,340');
    expect(line).toContain('div#board.canvas');
  });

  /**
   * ⚠️ A stale outline is worse than none. Left pointing at the last element, it answers a question
   * nobody asked and quietly contradicts the pointer, which is the exact confusion this exists to end.
   */
  it('hides rather than leaving a rectangle behind when there is no target', () => {
    const { overlay } = build();
    overlay.setEnabled(true);
    overlay.highlight(boxed(50, 40));

    overlay.highlight(null);

    expect(overlay.getElement().style.display).toBe('none');
  });
});
