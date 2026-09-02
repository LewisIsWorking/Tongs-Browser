import { describe, expect, it, vi } from 'vitest';

import { actionIds, findAction } from './support/trayHandlers.js';

/**
 * Whether the create button is offered at all. Written 2026-09-02.
 *
 * ⚠️ ABSENT, not disabled, and only until the relay lands. A player cannot create an actor without
 * Foundry's `ACTOR_CREATE`, and cannot be handed ownership of one by anybody but a GM, so the button
 * could only ever fail for them.
 *
 * A control that is present and cannot work is worse than one that is absent. It invites a tap, and
 * the failure then reads as a broken module rather than as a feature that is not finished yet. That
 * distinction matters on a phone, where the user has no console to check which it was.
 *
 * Its own file because the tray suite crossed the 200 line limit; that one owns which buttons exist
 * and what they do, this one owns who is offered this one.
 */
describe('the create button', () => {
  it('is offered when the user may create sheets', () => {
    expect(actionIds({ canCreateSheets: () => true })).toContain('create-sheet');
  });

  it('is not offered at all when they may not', () => {
    expect(actionIds({ canCreateSheets: () => false })).not.toContain('create-sheet');
  });

  /** ⚠️ Hiding one button must not take the others with it. */
  it('leaves every other button in place when hidden', () => {
    const hidden = actionIds({ canCreateSheets: () => false });

    expect(hidden).toContain('character');
    expect(hidden).toContain('sidebar');
    expect(hidden.length).toBe(actionIds({ canCreateSheets: () => true }).length - 1);
  });

  it('runs the create handler when tapped', () => {
    const createSheet = vi.fn();

    findAction({ createSheet }, 'create-sheet').activate();

    expect(createSheet).toHaveBeenCalledOnce();
  });

  /** ⚠️ Sits beside the character button: "open mine" and "make one" are the same errand. */
  it('sits next to the character button rather than across the bar', () => {
    const ids = actionIds();

    expect(ids.indexOf('create-sheet')).toBe(ids.indexOf('character') + 1);
  });
});
