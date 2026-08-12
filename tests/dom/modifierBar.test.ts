import { beforeEach, describe, expect, it } from 'vitest';

import { KeyLatch } from '../../src/modifiers/ModifierState.js';
import { createBar, keyButton, recorded, startRecording } from './support/keyboardRecording.js';

beforeEach(() => {
  startRecording();
});

describe('ModifierBar keys', () => {
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
    recorded.length = 0;

    keyButton(bar, 'ShiftLeft').click();

    expect(bar.getLatches().ShiftLeft).toBe(KeyLatch.LATCHED);
    expect(recorded.map((entry) => `${entry.type}:${entry.code}`)).toEqual(['keydown:ShiftLeft']);
  });

  it('locks on second tap without sending a duplicate keydown', () => {
    const { bar } = createBar();
    keyButton(bar, 'ShiftLeft').click();
    recorded.length = 0;
    keyButton(bar, 'ShiftLeft').click();

    expect(bar.getLatches().ShiftLeft).toBe(KeyLatch.LOCKED);
    expect(recorded).toEqual([]);
  });

  it('releases on third tap and dispatches a keyup', () => {
    const { bar } = createBar();
    keyButton(bar, 'ShiftLeft').click();
    keyButton(bar, 'ShiftLeft').click();
    recorded.length = 0;
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
    recorded.length = 0;
    keyButton(bar, 'Escape').click();

    expect(recorded.map((entry) => `${entry.type}:${entry.code}`)).toEqual([
      'keydown:Escape',
      'keyup:Escape',
    ]);
  });

  it('carries latched modifiers onto a momentary key, so combinations are reachable', () => {
    const { bar } = createBar();
    keyButton(bar, 'ControlLeft').click();
    recorded.length = 0;
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
});
