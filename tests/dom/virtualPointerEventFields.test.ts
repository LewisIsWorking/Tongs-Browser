import { describe, expect, it } from 'vitest';

import { VIRTUAL_POINTER_ID, createPointer, makeRegion } from './support/pointerHarness.js';

describe('VirtualPointer event fields', () => {
  it('stamps the reserved pointer id and a mouse pointer type on every pointer event', () => {
    const region = makeRegion('a', 0, 0, 100, 100);
    const seen: { id: number; type: string; primary: boolean }[] = [];
    region.addEventListener('pointerdown', (event) => {
      seen.push({ id: event.pointerId, type: event.pointerType, primary: event.isPrimary });
    });

    createPointer({ clientX: 10, clientY: 10 }).leftClick();

    expect(seen).toEqual([{ id: VIRTUAL_POINTER_ID, type: 'mouse', primary: true }]);
  });

  it('carries modifier flags through to the dispatched event', () => {
    const region = makeRegion('a', 0, 0, 100, 100);
    const seen: boolean[] = [];
    region.addEventListener('pointerdown', (event) => {
      seen.push(event.shiftKey);
    });

    const pointer = createPointer({ clientX: 10, clientY: 10 });
    pointer.setModifiers({ ctrlKey: false, shiftKey: true, altKey: false, metaKey: false });
    pointer.leftClick();

    expect(seen).toEqual([true]);
  });

  it('dispatches a pixel mode wheel event carrying the delta sign', () => {
    const region = makeRegion('a', 0, 0, 100, 100);
    const seen: { deltaY: number; deltaMode: number }[] = [];
    region.addEventListener('wheel', (event) => {
      seen.push({ deltaY: event.deltaY, deltaMode: event.deltaMode });
    });

    createPointer({ clientX: 10, clientY: 10 }).wheel(-120);

    expect(seen).toEqual([{ deltaY: -120, deltaMode: 0 }]);
  });
});
