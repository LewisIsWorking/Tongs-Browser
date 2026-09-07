import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KeyButtons } from '../../src/modifiers/KeyButtons.js';
import { MOMENTARY_KEYS } from '../../src/modifiers/keyDefinitions.js';

/**
 * The target key. Written 2026-09-07.
 *
 * ⛔ WHY IT IS A CAPABILITY AND NOT A CONVENIENCE. Without a keyboard there was no way to target a
 * token at all, and most systems resolve an attack against a target. Foundry binds it to `KeyT`
 * and the bar had Ctrl, Shift, Alt, Space, Delete, Escape, Enter and Tab, so the one key that
 * decides who an attack is against was the one a phone could not reach.
 *
 * COVERS: that the key exists, carries Foundry's `code`, and composes with a latched Shift.
 * MISSES: that Foundry actually targets anything. `#onTarget` reads `canvas.activeLayer.hover` and
 *   needs a live canvas with a hovered token; that belongs to the device harness. What is asserted
 *   here is the half this module owns, which is the event it sends.
 */
let container: HTMLDivElement;

/**
 * ⚠️ ONE ORDERED LOG, not three arrays by kind. The first version of this file kept `pressed`,
 * `released` and `tapped` separately and asserted the contents of each, which passes whether Shift
 * is released before the tap or after it. Before it is the bug: Foundry would see a plain T and
 * clear the other targets. Order is the property under test, so order has to be what is recorded.
 */
let log: string[];

const synthesizer = () =>
  ({
    press: (definition: { code: string }) => log.push(`press ${definition.code}`),
    release: (definition: { code: string }) => log.push(`release ${definition.code}`),
    tap: (definition: { code: string }) => log.push(`tap ${definition.code}`),
  }) as never;

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.append(container);
  log = [];
});

const build = (): void => {
  new KeyButtons({
    document,
    synthesizer: synthesizer(),
    onLatchesChanged: vi.fn(),
  }).build(container);
};

const button = (code: string): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>(`[data-code="${code}"]`);

describe('the target key', () => {
  /**
   * ⚠️ Asserts the CODE, not the label. Foundry's keybinding system matches on
   * `KeyboardEvent.code` throughout, so an event carrying only `key: 't'` is invisible to it. The
   * label is cosmetic and the code is the contract.
   */
  it('is offered, and carries the code Foundry binds targeting to', () => {
    const definition = MOMENTARY_KEYS.find((candidate) => candidate.code === 'KeyT');

    expect(definition).toBeDefined();
    expect(definition?.sticky).toBe(false);
    expect(definition?.key).toBe('t');
  });

  it('builds a button that taps that key', () => {
    build();

    button('KeyT')?.click();

    expect(log).toEqual(['tap KeyT']);
  });

  /**
   * ⚠️ A symbol label needs saying out loud somewhere. Every other key on the bar reads as its own
   * name; `🎯` does not, and a control nobody can identify is one nobody presses.
   */
  it('explains itself, because its label is a symbol', () => {
    build();

    expect(button('KeyT')?.title).toContain('Target');
  });

  /**
   * ⛔ THE ONE THAT MATTERS FOR PLAY. Foundry's handler ends
   * `setTarget(..., {releaseOthers: !context.isShift})`, so Shift is what turns "replace my target"
   * into "add to my targets". It reads that from its own held-key set, which the sticky latch is
   * already in, so multi-targeting must work with no code here knowing about it: Shift goes down
   * and is still down when the tap is sent.
   */
  it('sends the tap while a latched Shift is still held, so Shift+T adds a target', () => {
    build();

    button('ShiftLeft')?.click();
    button('KeyT')?.click();

    /*
     * ⚠️ Asserted as a SEQUENCE. Shift must still be down when the tap goes out and be released
     * only afterwards; releasing first would have Foundry read a plain T, clear every other target
     * and replace it with this one, which is the opposite of what the user asked for.
     */
    expect(log).toEqual(['press ShiftLeft', 'tap KeyT', 'release ShiftLeft']);
  });
});
