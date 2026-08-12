import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModifierBar } from '../../src/modifiers/ModifierBar.js';
import { startRecording, synthesizer } from './support/keyboardRecording.js';

beforeEach(() => {
  startRecording();
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
});
