import { describe, expect, it } from 'vitest';

import { createPointer, makeRegion, recorded, regions } from './support/pointerHarness.js';

describe('VirtualPointer clicks', () => {
  it('dispatches a full left click sequence at the pointer position', () => {
    makeRegion('a', 0, 0, 100, 100);
    const pointer = createPointer({ clientX: 40, clientY: 40 });

    pointer.leftClick();

    expect(recorded.map((entry) => entry.type)).toEqual([
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ]);
    expect(recorded.every((entry) => entry.clientX === 40 && entry.clientY === 40)).toBe(true);
  });

  it('ends a right click in a cancelable contextmenu that Foundry can suppress', () => {
    const region = makeRegion('a', 0, 0, 100, 100);
    let prevented = false;
    region.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      prevented = event.cancelable;
    });
    const pointer = createPointer({ clientX: 40, clientY: 40 });

    pointer.rightClick();

    expect(recorded.map((entry) => entry.type)).toContain('contextmenu');
    expect(prevented).toBe(true);
  });

  it('reaches a listener bound on an ancestor, so delegated handlers work', () => {
    const parent = document.createElement('div');
    parent.id = 'parent';
    document.body.append(parent);
    const child = document.createElement('button');
    child.id = 'child';
    parent.append(child);
    regions.push({ element: child, x: 0, y: 0, width: 100, height: 100 });

    const seen: string[] = [];
    parent.addEventListener('click', (event) => {
      seen.push((event.target as Element).id);
    });

    createPointer({ clientX: 10, clientY: 10 }).leftClick();

    expect(seen).toEqual(['child']);
  });
});
