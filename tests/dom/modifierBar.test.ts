import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  KeyboardSynthesizer,
  type KeyboardManagerLike,
} from '../../src/modifiers/KeyboardSynthesizer.js';
import { ModifierBar } from '../../src/modifiers/ModifierBar.js';
import { KeyLatch } from '../../src/modifiers/ModifierState.js';
import type { ModifierFlags } from '../../src/pointer/ModifierFlags.js';

interface Recorded {
  readonly type: string;
  readonly code: string;
  readonly key: string;
  readonly keyCode: number;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

let recorded: Recorded[] = [];

function record(event: KeyboardEvent): void {
  recorded.push({
    type: event.type,
    code: event.code,
    key: event.key,
    // Deprecated on purpose. The synthesizer sets keyCode precisely because plenty of older module
    // code in the Foundry ecosystem still reads it, so the test has to read it too.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    keyCode: event.keyCode,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  recorded = [];
  document.addEventListener('keydown', record);
  document.addEventListener('keyup', record);
});

function synthesizer(manager: KeyboardManagerLike | null): KeyboardSynthesizer {
  return new KeyboardSynthesizer({ document, getKeyboardManager: () => manager });
}

describe('KeyboardSynthesizer event shape', () => {
  /**
   * The field that decides whether any of this works. Foundry's keybinding system is code based
   * throughout, so an event carrying only key is invisible to it no matter how correct it otherwise
   * looks.
   */
  it('sets code, which is what Foundry matches keybindings on', () => {
    synthesizer(null).press({
      code: 'ShiftLeft',
      key: 'Shift',
      keyCode: 16,
      label: 'Shift',
      sticky: true,
    });

    expect(recorded[0]).toMatchObject({ type: 'keydown', code: 'ShiftLeft', key: 'Shift' });
  });

  it('also sets the deprecated keyCode and which, which older modules still read', () => {
    synthesizer(null).press({
      code: 'Delete',
      key: 'Delete',
      keyCode: 46,
      label: 'Del',
      sticky: false,
    });

    expect(recorded[0]?.keyCode).toBe(46);
  });

  it('reflects held modifiers as flags on the event itself', () => {
    const subject = synthesizer(null);
    subject.press({ code: 'ShiftLeft', key: 'Shift', keyCode: 16, label: 'Shift', sticky: true });
    recorded = [];
    subject.press({ code: 'Delete', key: 'Delete', keyCode: 46, label: 'Del', sticky: false });

    expect(recorded[0]).toMatchObject({ code: 'Delete', shiftKey: true, ctrlKey: false });
  });

  it('reports the key being pressed as held on its own keydown', () => {
    synthesizer(null).press({
      code: 'ControlLeft',
      key: 'Control',
      keyCode: 17,
      label: 'Ctrl',
      sticky: true,
    });

    expect(recorded[0]?.ctrlKey).toBe(true);
  });

  it('reports the key as released on its own keyup', () => {
    const subject = synthesizer(null);
    const definition = {
      code: 'ControlLeft',
      key: 'Control',
      keyCode: 17,
      label: 'Ctrl',
      sticky: true,
    };
    subject.press(definition);
    recorded = [];
    subject.release(definition);

    expect(recorded[0]).toMatchObject({ type: 'keyup', ctrlKey: false });
  });

  it('sends a full press and release on a tap', () => {
    synthesizer(null).tap({
      code: 'Escape',
      key: 'Escape',
      keyCode: 27,
      label: 'Esc',
      sticky: false,
    });

    expect(recorded.map((entry) => entry.type)).toEqual(['keydown', 'keyup']);
  });
});

/**
 * The module's biggest open risk, and genuinely unknowable without a running Foundry. If Foundry
 * declines to update its internal held key set from an untrusted event, every synthesised modifier
 * is invisible however correctly the event is built, and the whole feature is dead. So the strategy
 * is measured rather than assumed.
 */
describe('KeyboardSynthesizer isTrusted probe', () => {
  it('reports events when Foundry honours a synthesised keydown', () => {
    const downKeys = new Set<string>();
    document.addEventListener('keydown', (event) => {
      downKeys.add(event.code);
    });
    const manager: KeyboardManagerLike = { downKeys };

    expect(synthesizer(manager).probe()).toBe('events');
  });

  it('reports direct when Foundry ignores the synthesised keydown', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
    expect(synthesizer(manager).probe()).toBe('direct');
  });

  it('reports unknown when the keyboard manager is absent entirely', () => {
    expect(synthesizer(null).probe()).toBe('unknown');
  });

  it('leaves no trace of the probe key behind', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
    const subject = synthesizer(manager);
    subject.probe();

    expect(manager.downKeys?.has('ShiftLeft')).toBe(false);
    expect(subject.getHeldCodes().has('ShiftLeft')).toBe(false);
  });

  /**
   * Probing while the user genuinely holds shift on a physical keyboard would read the real key as
   * proof that synthesis works, and a false positive here disables the fallback silently.
   */
  it('declines to probe while the user is really holding the probe key', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>(['ShiftLeft']) };
    expect(synthesizer(manager).probe()).toBe('unknown');
  });

  it('writes the down keys set directly once the direct strategy is chosen', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
    const subject = synthesizer(manager);
    subject.probe();
    expect(subject.getStrategy()).toBe('direct');

    subject.press({ code: 'AltLeft', key: 'Alt', keyCode: 18, label: 'Alt', sticky: true });
    expect(manager.downKeys?.has('AltLeft')).toBe(true);

    subject.release({ code: 'AltLeft', key: 'Alt', keyCode: 18, label: 'Alt', sticky: true });
    expect(manager.downKeys?.has('AltLeft')).toBe(false);
  });

  it('does not touch the set when events are honoured, leaving Foundry to manage it', () => {
    const downKeys = new Set<string>();
    document.addEventListener('keydown', (event) => {
      downKeys.add(event.code);
    });
    const manager: KeyboardManagerLike = { downKeys };
    const subject = synthesizer(manager);
    subject.probe();
    expect(subject.getStrategy()).toBe('events');

    downKeys.clear();
    document.removeEventListener('keydown', record);
    subject.press({ code: 'AltLeft', key: 'Alt', keyCode: 18, label: 'Alt', sticky: true });

    // Present only because the listener above added it, not because the synthesizer wrote it.
    expect(downKeys.has('AltLeft')).toBe(true);
  });
});

describe('ModifierBar', () => {
  function createBar(): { bar: ModifierBar; flags: ModifierFlags[] } {
    const flags: ModifierFlags[] = [];
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: (next) => flags.push(next),
    });
    bar.attach();
    return { bar, flags };
  }

  function keyButton(bar: ModifierBar, code: string): HTMLButtonElement {
    const button = bar.getElement().querySelector<HTMLButtonElement>(`[data-code="${code}"]`);
    if (button === null) {
      throw new Error(`No button for ${code}`);
    }
    return button;
  }

  it('renders outside Foundry interface subtree so it survives re-renders', () => {
    const { bar } = createBar();
    expect(bar.getElement().parentElement).toBe(document.body);
  });

  /**
   * Without this the gesture layer would route a tap on the bar through the virtual pointer, which
   * is circular: you would need a modifier held to press the key that holds the modifier.
   */
  it('marks itself as ignored so the gesture layer never routes its own taps', () => {
    const { bar } = createBar();
    expect(bar.getElement().getAttribute('data-tongs-browser')).toBe('ignore');
  });

  it('latches on first tap and dispatches a keydown', () => {
    const { bar } = createBar();
    recorded = [];

    keyButton(bar, 'ShiftLeft').click();

    expect(bar.getLatches().ShiftLeft).toBe(KeyLatch.LATCHED);
    expect(recorded.map((entry) => `${entry.type}:${entry.code}`)).toEqual(['keydown:ShiftLeft']);
  });

  it('locks on second tap without sending a duplicate keydown', () => {
    const { bar } = createBar();
    keyButton(bar, 'ShiftLeft').click();
    recorded = [];
    keyButton(bar, 'ShiftLeft').click();

    expect(bar.getLatches().ShiftLeft).toBe(KeyLatch.LOCKED);
    expect(recorded).toEqual([]);
  });

  it('releases on third tap and dispatches a keyup', () => {
    const { bar } = createBar();
    keyButton(bar, 'ShiftLeft').click();
    keyButton(bar, 'ShiftLeft').click();
    recorded = [];
    keyButton(bar, 'ShiftLeft').click();

    expect(bar.getLatches().ShiftLeft).toBe(KeyLatch.OFF);
    expect(recorded.map((entry) => `${entry.type}:${entry.code}`)).toEqual(['keyup:ShiftLeft']);
  });

  it('shows the three latch states distinguishably, not by colour alone', () => {
    const { bar } = createBar();
    const button = keyButton(bar, 'AltLeft');

    expect(button.dataset['latch']).toBe(KeyLatch.OFF);
    button.click();
    expect(button.dataset['latch']).toBe(KeyLatch.LATCHED);
    button.click();
    expect(button.dataset['latch']).toBe(KeyLatch.LOCKED);
  });

  it('reports the new flags so the pointer can carry them', () => {
    const { bar, flags } = createBar();
    keyButton(bar, 'ControlLeft').click();

    expect(flags.at(-1)).toEqual({
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });
  });

  it('sends a full press and release for a momentary key', () => {
    const { bar } = createBar();
    recorded = [];
    keyButton(bar, 'Escape').click();

    expect(recorded.map((entry) => `${entry.type}:${entry.code}`)).toEqual([
      'keydown:Escape',
      'keyup:Escape',
    ]);
  });

  it('carries latched modifiers onto a momentary key, so combinations are reachable', () => {
    const { bar } = createBar();
    keyButton(bar, 'ControlLeft').click();
    recorded = [];
    keyButton(bar, 'Delete').click();

    expect(recorded[0]).toMatchObject({ code: 'Delete', ctrlKey: true });
  });

  /** What makes LATCHED mean "for the next action only". */
  it('clears latched modifiers after a momentary key uses them', () => {
    const { bar } = createBar();
    keyButton(bar, 'ControlLeft').click();
    keyButton(bar, 'Delete').click();

    expect(bar.getLatches().ControlLeft).toBe(KeyLatch.OFF);
  });

  it('leaves locked modifiers held after a momentary key uses them', () => {
    const { bar } = createBar();
    keyButton(bar, 'ControlLeft').click();
    keyButton(bar, 'ControlLeft').click();
    keyButton(bar, 'Delete').click();

    expect(bar.getLatches().ControlLeft).toBe(KeyLatch.LOCKED);
  });

  it('collapses and expands, reporting the change for persistence', () => {
    const changes: boolean[] = [];
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      onCollapsedChanged: (collapsed) => changes.push(collapsed),
    });
    bar.attach();

    bar.setCollapsed(true);
    expect(bar.isCollapsed()).toBe(true);
    expect(bar.getElement().classList.contains('tb-modifier-bar--collapsed')).toBe(true);

    bar.setCollapsed(false);
    expect(changes).toEqual([true, false]);
  });

  it('reports position changes so they can be persisted per client', () => {
    const positions: { x: number; y: number }[] = [];
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      onPositionChanged: (position) => positions.push(position),
    });
    bar.attach();

    bar.setPosition({ x: 200, y: 40 });

    expect(positions).toEqual([{ x: 200, y: 40 }]);
    expect(bar.getElement().style.left).toBe('200px');
    expect(bar.getElement().style.top).toBe('40px');
  });

  /**
   * Detaching without releasing would leave Foundry believing shift is down with no visible control
   * left for the user to clear it.
   */
  it('releases everything held when detached', () => {
    const { bar } = createBar();
    keyButton(bar, 'ShiftLeft').click();
    recorded = [];

    bar.detach();

    expect(recorded.map((entry) => `${entry.type}:${entry.code}`)).toEqual(['keyup:ShiftLeft']);
    expect(bar.getLatches().ShiftLeft).toBe(KeyLatch.OFF);
  });

  it('offers every key the brief asks for', () => {
    const { bar } = createBar();
    const codes = [...bar.getElement().querySelectorAll('[data-code]')].map(
      (element) => (element as HTMLElement).dataset['code']
    );

    expect(codes).toEqual([
      'ControlLeft',
      'ShiftLeft',
      'AltLeft',
      'Space',
      'Delete',
      'Escape',
      'Enter',
      'Tab',
    ]);
  });

  it('is idempotent on repeated attach', () => {
    const { bar } = createBar();
    bar.attach();
    expect(document.querySelectorAll('.tb-modifier-bar')).toHaveLength(1);
  });
});

describe('ModifierBar drag handle', () => {
  it('moves the bar as the handle is dragged', () => {
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      initialPosition: { x: 100, y: 100 },
    });
    bar.attach();

    const handle = bar.getElement().querySelector('.tb-modifier-bar__handle');
    if (handle === null) {
      throw new Error('No handle');
    }
    // jsdom does not implement pointer capture, so it is stubbed. The binder calls it optionally
    // for exactly this reason.
    (handle as Element & { setPointerCapture?: unknown }).setPointerCapture = vi.fn();
    (handle as Element & { releasePointerCapture?: unknown }).releasePointerCapture = vi.fn();

    handle.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, clientX: 110, clientY: 105, bubbles: true })
    );
    handle.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 210, clientY: 155, bubbles: true })
    );

    expect(bar.getPosition()).toEqual({ x: 200, y: 150 });
  });

  /**
   * The bar is kept inside the viewport, using the numbers a real device produced.
   *
   * Measured 2026-08-10 on a 412x783 Android viewport running Foundry 14.365: the bar rendered from
   * x 88 to x 532 and put Esc, Enter and Tab entirely off screen, with no clamping anywhere in the
   * class. jsdom reports offsetWidth as 0, which is exactly why the live check found this and the
   * unit suite did not, so the size is stubbed here rather than assumed.
   */
  describe('staying inside the viewport', () => {
    const PHONE = { width: 412, height: 783 };

    function barSized(
      width: number,
      height: number,
      initialPosition = { x: 0, y: 0 }
    ): ModifierBar {
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

  it('ignores a move from a different pointer than the one that started the drag', () => {
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      initialPosition: { x: 100, y: 100 },
    });
    bar.attach();

    const handle = bar.getElement().querySelector('.tb-modifier-bar__handle');
    if (handle === null) {
      throw new Error('No handle');
    }
    (handle as Element & { setPointerCapture?: unknown }).setPointerCapture = vi.fn();

    handle.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, clientX: 110, clientY: 105, bubbles: true })
    );
    handle.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 2, clientX: 900, clientY: 900, bubbles: true })
    );

    expect(bar.getPosition()).toEqual({ x: 100, y: 100 });
  });
});
