import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModifierBar } from '../../src/modifiers/ModifierBar.js';
import { startRecording, synthesizer } from './support/keyboardRecording.js';

beforeEach(() => {
  startRecording();
});
describe('ModifierBar handle clamping', () => {
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
