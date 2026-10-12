import { afterEach, describe, expect, it, vi } from 'vitest';

import { DUAL_CLASS_EVENT } from '../../src/dualclass/startDualClassPlayer.js';
import { clearWorld, findTrayAction, globals } from './support/trayWiringWorld.js';

/** The tray's "Dual class…" button, wired: players only, and it asks the player side to open. 2026-10-12. */
afterEach(() => {
  clearWorld();
});

describe('the dual class button', () => {
  it('is on a player’s tray and sends the event the player side opens its window on', () => {
    globals['game'] = { user: { id: 'p1', isGM: false }, actors: [], users: [] };
    const heard = vi.fn();
    document.addEventListener(DUAL_CLASS_EVENT, heard);
    findTrayAction('dual-class')?.activate();
    document.removeEventListener(DUAL_CLASS_EVENT, heard);
    expect(heard).toHaveBeenCalledOnce();
  });

  it('is not on a GM’s tray', () => {
    globals['game'] = { user: { id: 'gm1', isGM: true }, actors: [], users: [] };
    expect(findTrayAction('dual-class')).toBeUndefined();
  });
});
