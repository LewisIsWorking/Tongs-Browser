import { describe, expect, it, vi } from 'vitest';

import { actionIds, findAction } from './support/trayHandlers.js';

/**
 * Whether the gated buttons are offered at all. Written 2026-09-02, widened 2026-09-03.
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
 * and what they do, this one owns who is offered them.
 *
 * ⚠️ The two gates are SEPARATE, and this file asserts them separately for a reason that arrives with
 * the relay: creating opens to players in a party their GM allowed, while deciding WHICH parties
 * those are stays a GM's alone, permanently. A single flag serving both would need splitting at
 * exactly the moment it mattered most.
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

describe('the party access button', () => {
  it('is offered to someone who may manage party access', () => {
    expect(actionIds({ canManagePartyAccess: () => true })).toContain('party-access');
  });

  it('is not offered at all when they may not', () => {
    expect(actionIds({ canManagePartyAccess: () => false })).not.toContain('party-access');
  });

  /** ⚠️ The two gates are independent: hiding one must not hide the other. */
  it('is unaffected by the create gate, and does not affect it', () => {
    const noCreate = actionIds({ canCreateSheets: () => false });
    expect(noCreate).toContain('party-access');
    expect(noCreate).not.toContain('create-sheet');

    const noAccess = actionIds({ canManagePartyAccess: () => false });
    expect(noAccess).toContain('create-sheet');
    expect(noAccess).not.toContain('party-access');
  });

  it('runs the manage handler when tapped', () => {
    const managePartyAccess = vi.fn();

    findAction({ managePartyAccess }, 'party-access').activate();

    expect(managePartyAccess).toHaveBeenCalledOnce();
  });
});

/** Dual class (2026-10-12): a player's errand, so a GM's tray does not carry it. */
describe('the dual class button', () => {
  it('is offered only when its own gate says so', () => {
    expect(actionIds({ canDualClass: () => true })).toContain('dual-class');
    expect(actionIds({ canDualClass: () => false })).not.toContain('dual-class');
  });

  it('opens the dual class window when tapped, and says what it does', () => {
    const openDualClass = vi.fn();
    const action = findAction({ openDualClass }, 'dual-class');
    action.activate();
    expect(openDualClass).toHaveBeenCalledOnce();
    expect(action.title).toBe('Dual class…: give one of your characters two classes');
  });
});
