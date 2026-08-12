import { beforeEach, describe, expect, it } from 'vitest';

import { ModifierBar } from '../../src/modifiers/ModifierBar.js';
import { startRecording, synthesizer } from './support/keyboardRecording.js';

beforeEach(() => {
  startRecording();
}); /**
 * The bar is kept inside the viewport, using the numbers a real device produced.
 *
 * Measured 2026-08-10 on a 412x783 Android viewport running Foundry 14.365: the bar rendered from
 * x 88 to x 532 and put Esc, Enter and Tab entirely off screen, with no clamping anywhere in the
 * class. jsdom reports offsetWidth as 0, which is exactly why the live check found this and the
 * unit suite did not, so the size is stubbed here rather than assumed.
 */
describe('staying inside the viewport', () => {
  const PHONE = { width: 412, height: 783 };

  function barSized(width: number, height: number, initialPosition = { x: 0, y: 0 }): ModifierBar {
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      initialPosition,
    });
    bar.attach();
    // jsdom has no layout engine, so the laid out size has to be supplied.
    Object.defineProperty(bar.getElement(), 'offsetWidth', { value: width, configurable: true });
    Object.defineProperty(bar.getElement(), 'offsetHeight', {
      value: height,
      configurable: true,
    });
    return bar;
  }

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: PHONE.width, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: PHONE.height, configurable: true });
  });

  it('pulls the bar back when it would hang off the right edge', () => {
    const bar = barSized(404, 52);
    bar.setPosition({ x: 88, y: 120 });

    // 412 - 404 = 8, so the shipped default of 88 cannot be honoured on a phone.
    expect(bar.getPosition()).toEqual({ x: 8, y: 120 });
  });

  it('pulls the bar back when it would hang off the bottom edge', () => {
    const bar = barSized(200, 100);
    bar.setPosition({ x: 10, y: 760 });

    expect(bar.getPosition()).toEqual({ x: 10, y: 683 });
  });

  it('leaves a position that already fits completely alone', () => {
    const bar = barSized(200, 100);
    bar.setPosition({ x: 30, y: 40 });

    expect(bar.getPosition()).toEqual({ x: 30, y: 40 });
  });

  /**
   * Feeding the guard the original bug: a 444px bar on a 412px viewport, which is what shipped.
   * It cannot fit, so the requirement is that its LEFT edge is visible. Centring the overflow or
   * allowing a negative x would hide controls on both sides instead of one.
   */
  it('shows the left edge when the bar is genuinely wider than the screen', () => {
    const bar = barSized(444, 52);
    bar.setPosition({ x: 88, y: 120 });

    expect(bar.getPosition()).toEqual({ x: 0, y: 120 });
  });

  it('never moves the bar to a negative coordinate', () => {
    const bar = barSized(200, 100);
    bar.setPosition({ x: -50, y: -80 });

    expect(bar.getPosition()).toEqual({ x: 0, y: 0 });
  });

  /**
   * Keeping out of the sidebar, using the numbers a real phone produced.
   *
   * Measured 2026-08-11 on a 412x915 viewport: Foundry's sidebar occupies the right edge from
   * x 393, and the wrapped bar reached x 412, so the shipped default sat on top of the sidebar's
   * icon column. That column is the only route to chat and actors on a phone.
   */
  it('keeps clear of the sidebar when there is room to do so', () => {
    const bar = barSized(324, 130);
    // 393 is where the sidebar started, less the 4px gap.
    bar.setPosition({ x: 88, y: 120 });

    const withSidebar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      initialPosition: { x: 88, y: 120 },
      getAvailableWidth: () => 389,
    });
    withSidebar.attach();
    Object.defineProperty(withSidebar.getElement(), 'offsetWidth', {
      value: 324,
      configurable: true,
    });
    Object.defineProperty(withSidebar.getElement(), 'offsetHeight', {
      value: 130,
      configurable: true,
    });
    withSidebar.setPosition({ x: 88, y: 120 });

    // 389 - 324 = 65, so the bar has to come left to clear the sidebar.
    expect(withSidebar.getPosition().x).toBe(65);
    // Without the sidebar it would have been allowed all the way to 412 - 324 = 88.
    expect(bar.getPosition().x).toBe(88);
  });

  /**
   * The WIDTH is capped, not just the position.
   *
   * The bar is position: fixed with only `left` set, so it is shrink to fit against the remaining
   * space and its right edge stays pinned to the viewport edge wherever it is placed. Measured on
   * a 412px phone: clamping x from 88 to 65 made the bar WIDER, 324 to 347, and the right edge did
   * not move at all. Capping max-width is the half that actually clears the sidebar.
   */
  it('caps its width so the right edge lands on the available width', () => {
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      initialPosition: { x: 88, y: 120 },
      getAvailableWidth: () => 389,
    });
    bar.attach();
    Object.defineProperty(bar.getElement(), 'offsetWidth', { value: 301, configurable: true });
    Object.defineProperty(bar.getElement(), 'offsetHeight', { value: 130, configurable: true });
    bar.setPosition({ x: 88, y: 120 });

    // 389 available minus a left edge of 88 leaves 301, so the right edge lands exactly on 389.
    expect(bar.getElement().style.maxWidth).toBe('301px');
  });

  /**
   * When the bar cannot fit beside the sidebar at all, overlapping is the lesser evil. Pushing it
   * off the left edge would trade a covered sidebar for a bar with keys nobody can reach.
   */
  it('falls back to the window when it cannot fit beside the sidebar', () => {
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      initialPosition: { x: 300, y: 120 },
      // A wide expanded sidebar leaves less room than the bar needs.
      getAvailableWidth: () => 100,
    });
    bar.attach();
    Object.defineProperty(bar.getElement(), 'offsetWidth', { value: 324, configurable: true });
    Object.defineProperty(bar.getElement(), 'offsetHeight', { value: 130, configurable: true });
    bar.setPosition({ x: 300, y: 120 });

    // Clamped to the window (412 - 324 = 88), not to the impossible 100 - 324.
    expect(bar.getPosition().x).toBe(88);
  });

  /**
   * Before layout the element reports a size of zero, and a clamp built on that would slam the bar
   * to the top left on every attach. Doing nothing is the correct answer until a size is known.
   */
  it('leaves the position untouched while the element has no measured size', () => {
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      initialPosition: { x: 300, y: 700 },
    });
    bar.attach();

    expect(bar.getPosition()).toEqual({ x: 300, y: 700 });
  });
});
