import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KeyButtons } from '../../src/modifiers/KeyButtons.js';
import { KeyLatch } from '../../src/modifiers/ModifierState.js';
import { MODIFIER_KEYS } from '../../src/modifiers/keyDefinitions.js';

/**
 * The modifier keys: their buttons, their latch state, and keeping the two in step.
 *
 * A key here has THREE states rather than two, which is the whole design. Off, latched for the next
 * action only, and locked until tapped off. Sticky keys are how a one finger user reaches
 * shift-click at all, and two states would force a choice between "cannot chord" and "silently still
 * held ten minutes later".
 */
let container: HTMLDivElement;
let pressed: string[];
let released: string[];
let tapped: string[];
let onLatchesChanged: ReturnType<typeof vi.fn<() => void>>;

const synthesizer = () =>
  ({
    press: (definition: { code: string }) => pressed.push(definition.code),
    release: (definition: { code: string }) => released.push(definition.code),
    tap: (definition: { code: string }) => tapped.push(definition.code),
  }) as never;

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.append(container);
  pressed = [];
  released = [];
  tapped = [];
  onLatchesChanged = vi.fn<() => void>();
});

const build = () => {
  const keys = new KeyButtons({ document, synthesizer: synthesizer(), onLatchesChanged });
  keys.build(container);
  return keys;
};

const tap = (code: string) => container.querySelector<HTMLButtonElement>(`[data-code="${code}"]`);

const STICKY = MODIFIER_KEYS[0]?.code ?? 'ShiftLeft';

describe('KeyButtons.clearAll', () => {
  it('releases everything held and returns every key to off', () => {
    const keys = build();
    // Locked, which is the state that survives an action, so clearAll is the only way out of it.
    tap(STICKY)?.click();
    tap(STICKY)?.click();

    keys.clearAll();

    expect(tap(STICKY)?.dataset['latch']).toBe(KeyLatch.OFF);
    expect(tap(STICKY)?.getAttribute('aria-pressed')).toBe('false');
    expect(released).toEqual([STICKY]);
  });
});
describe('KeyButtons.get', () => {
  it('hands back a built button, and nothing for an unknown code', () => {
    const keys = build();

    expect(keys.get(STICKY)).toBe(tap(STICKY));
    expect(keys.get('NoSuchKey')).toBeUndefined();
  });
});
describe('a button that has gone missing', () => {
  /**
   * A key can go missing when something else re-renders over the bar. The render guard skips that one
   * rather than throwing, which would take every remaining key with it.
   */
  it('renders the remaining keys when one button has gone', () => {
    const keys = build();
    const buttons = (keys as unknown as { buttons: Map<string, HTMLButtonElement> }).buttons;
    const firstCode = [...buttons.keys()][0];
    if (firstCode === undefined) {
      throw new Error('no keys were built');
    }
    buttons.delete(firstCode);

    expect(() => {
      tap(STICKY === firstCode ? (MODIFIER_KEYS[1]?.code ?? STICKY) : STICKY)?.click();
    }).not.toThrow();

    const survivor = container.querySelector('.tb-key');
    expect(survivor?.hasAttribute('aria-pressed')).toBe(true);
  });
});
