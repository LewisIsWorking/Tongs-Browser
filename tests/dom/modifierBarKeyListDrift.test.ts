import { describe, expect, it, vi } from 'vitest';

import { MODIFIER_CODES } from '../../src/modifiers/ModifierState.js';

/**
 * The sticky modifiers are declared TWICE, in two files, by hand.
 *
 * `MODIFIER_CODES` in `ModifierState.ts` is what `diff` walks; `MODIFIER_KEYS` in
 * `keyDefinitions.ts` is what carries the key, keyCode and label used to synthesise the event.
 * Neither is derived from the other, so they can drift, and `KeyButtons.apply` has a guard that skips
 * a changed code it has no definition for.
 *
 * That guard is worth having and was worth executing. If the lists drift, the silent outcome is a
 * modifier that latches in the UI and is never actually pressed: the bar shows Alt held, Foundry
 * never hears about it, and the user is left believing they alt clicked. Skipping beats throwing
 * mid render, but only a test can say the skip works, because the guard cannot fire while the two
 * lists agree.
 */
vi.mock('../../src/modifiers/keyDefinitions.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/modifiers/keyDefinitions.js')>();
  return {
    ...original,
    // Drop AltLeft from the definitions while ModifierState still lists the code. This is precisely
    // the drift, staged.
    MODIFIER_KEYS: original.MODIFIER_KEYS.filter((key) => key.code !== 'AltLeft'),
  };
});

describe('KeyButtons when the two key lists have drifted', () => {
  it('skips the orphaned modifier instead of pressing an undefined key', async () => {
    const { KeyButtons } = await import('../../src/modifiers/KeyButtons.js');
    const { KeyLatch } = await import('../../src/modifiers/ModifierState.js');

    const pressed: string[] = [];
    const keys = new KeyButtons({
      document,
      synthesizer: {
        press: (definition: { code: string }) => pressed.push(definition.code),
        release: () => undefined,
        tap: () => undefined,
      } as never,
      onLatchesChanged: () => undefined,
    });
    keys.build(document.createElement('div'));

    // Latch all three, including the one with no definition behind it any more.
    (keys as unknown as { apply: (next: Record<string, string>) => void }).apply({
      ControlLeft: KeyLatch.LATCHED,
      ShiftLeft: KeyLatch.LATCHED,
      AltLeft: KeyLatch.LATCHED,
    });

    // The two that still have definitions were pressed for real.
    expect(pressed).toContain('ControlLeft');
    expect(pressed).toContain('ShiftLeft');
    // The orphan was skipped rather than crashing the loop, which is the whole job of the guard.
    expect(pressed).not.toContain('AltLeft');
  });
});

describe('the two modifier key lists', () => {
  /**
   * And the invariant itself, unmocked, so the drift above stays hypothetical.
   *
   * The guard degrades gracefully; this is what stops anyone needing it. A skipped modifier is a
   * quiet wrong answer, and quiet wrong answers are what this whole module has been chasing.
   */
  it('agree, so no modifier can latch without a key behind it', async () => {
    const actual = await vi.importActual<typeof import('../../src/modifiers/keyDefinitions.js')>(
      '../../src/modifiers/keyDefinitions.js'
    );
    const defined = actual.MODIFIER_KEYS.map((key) => key.code);

    expect([...MODIFIER_CODES].sort()).toEqual([...defined].sort());
  });
});
