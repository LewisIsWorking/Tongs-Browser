import { beforeEach, describe, expect, it } from 'vitest';

import { ModifierBar } from '../../src/modifiers/ModifierBar.js';
import { KeyLatch } from '../../src/modifiers/ModifierState.js';
import {
  createBar,
  keyButton,
  recorded,
  startRecording,
  synthesizer,
} from './support/keyboardRecording.js';

beforeEach(() => {
  startRecording();
});
describe('ModifierBar lifecycle', () => {
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
    recorded.length = 0;

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
