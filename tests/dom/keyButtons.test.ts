import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KeyButtons } from '../../src/modifiers/KeyButtons.js';
import { KeyLatch } from '../../src/modifiers/ModifierState.js';
import { MODIFIER_KEYS, MOMENTARY_KEYS } from '../../src/modifiers/keyDefinitions.js';

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
const MOMENTARY = MOMENTARY_KEYS[0]?.code ?? 'Delete';

describe('KeyButtons.build', () => {
  it('builds a button for every sticky and momentary key', () => {
    build();

    for (const definition of [...MODIFIER_KEYS, ...MOMENTARY_KEYS]) {
      expect(tap(definition.code)).not.toBeNull();
    }
  });

  /** Painted at build, so a key already shows its latch rather than waiting for the first change. */
  it('paints the initial state immediately', () => {
    build();

    expect(tap(STICKY)?.getAttribute('aria-pressed')).toBe('false');
    expect(tap(STICKY)?.dataset['latch']).toBe(KeyLatch.OFF);
  });

  it('marks sticky and momentary keys differently, since they behave differently', () => {
    build();

    expect(tap(STICKY)?.classList.contains('tb-key--sticky')).toBe(true);
    expect(tap(MOMENTARY)?.classList.contains('tb-key--momentary')).toBe(true);
  });
});

describe('the three latch states', () => {
  it('cycles off, latched, locked and back on repeated taps', () => {
    const keys = build();
    const seen: string[] = [];

    for (let press = 0; press < 3; press += 1) {
      tap(STICKY)?.click();
      seen.push(String(tap(STICKY)?.dataset['latch']));
    }

    expect(seen).toEqual([KeyLatch.LATCHED, KeyLatch.LOCKED, KeyLatch.OFF]);
    expect(keys.getLatches()[STICKY as never]).toBe(KeyLatch.OFF);
  });

  /**
   * ⚠️ `data-latch` as well as the class, because the three states must be distinguishable without
   * relying on colour alone. `aria-pressed` is a boolean and cannot say which of latched or locked a
   * key is in, and those differ in exactly the thing the user needs to predict: one survives the next
   * action and one does not.
   */
  it('reports latched and locked as pressed, but tells them apart in the data', () => {
    build();

    tap(STICKY)?.click();
    expect(tap(STICKY)?.getAttribute('aria-pressed')).toBe('true');
    expect(tap(STICKY)?.dataset['latch']).toBe(KeyLatch.LATCHED);

    tap(STICKY)?.click();
    expect(tap(STICKY)?.getAttribute('aria-pressed')).toBe('true');
    expect(tap(STICKY)?.dataset['latch']).toBe(KeyLatch.LOCKED);
  });

  it('carries exactly one latch class at a time', () => {
    build();
    tap(STICKY)?.click();

    const classes = [...(tap(STICKY)?.classList ?? [])];
    expect(
      classes.filter(
        (name) =>
          name.startsWith('tb-key--o') || name === 'tb-key--latched' || name === 'tb-key--locked'
      )
    ).toEqual(['tb-key--latched']);
  });
});

describe('pressing the real key', () => {
  it('presses once when latched and releases once when cleared', () => {
    build();

    tap(STICKY)?.click();
    expect(pressed).toEqual([STICKY]);

    tap(STICKY)?.click();
    tap(STICKY)?.click();
    expect(released).toEqual([STICKY]);
  });

  /**
   * ⚠️ Diffing rather than replaying everything. Re-pressing an already held key sends a duplicate
   * keydown, and Foundry treats a repeated keydown as auto repeat, so a held Shift would arrive as a
   * stream of repeats rather than one press.
   */
  it('does not press again on the latched to locked step, since it was already held', () => {
    build();

    tap(STICKY)?.click();
    tap(STICKY)?.click();

    expect(pressed).toEqual([STICKY]);
  });

  it('tells the caller after every change', () => {
    build();

    tap(STICKY)?.click();
    tap(STICKY)?.click();

    expect(onLatchesChanged).toHaveBeenCalledTimes(2);
  });
});

describe('momentary keys', () => {
  /** Latch Ctrl, then tap Delete: this is what makes combinations reachable at all. */
  it('taps the key, carrying whatever is currently latched', () => {
    build();
    tap(STICKY)?.click();

    tap(MOMENTARY)?.click();

    expect(tapped).toEqual([MOMENTARY]);
  });

  /** LATCHED means "for the next action only", so the action consumes it. */
  it('clears a latched modifier after using it', () => {
    build();
    tap(STICKY)?.click();

    tap(MOMENTARY)?.click();

    expect(tap(STICKY)?.dataset['latch']).toBe(KeyLatch.OFF);
    expect(released).toEqual([STICKY]);
  });

  /** LOCKED means "until I say otherwise", so the action leaves it alone. */
  it('leaves a LOCKED modifier held', () => {
    build();
    tap(STICKY)?.click();
    tap(STICKY)?.click();

    tap(MOMENTARY)?.click();

    expect(tap(STICKY)?.dataset['latch']).toBe(KeyLatch.LOCKED);
    expect(released).toEqual([]);
  });

  it('changes nothing when there was nothing latched to consume', () => {
    build();

    tap(MOMENTARY)?.click();

    expect(onLatchesChanged).not.toHaveBeenCalled();
  });
});

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
