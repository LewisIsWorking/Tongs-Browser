import { beforeEach, describe, expect, it, vi } from 'vitest';

import { beginCreateSheet } from '../../src/ui/CreateSheetFlow.js';
import { DEFAULT_SHEET_NAME } from '../../src/ui/CreateSheetMessages.js';
import {
  GM,
  PLAYER,
  openParty,
  party,
  ports,
  rows,
  screenText,
} from './support/createSheetPorts.js';

/**
 * Getting from a tap to a decision: which party, and whose character. Written 2026-09-02.
 *
 * ⚠️ Asserted through the DOM the user actually touches, rather than by spying on calls between
 * modules. Every rule is already tested where it lives; what no per-module suite can see is whether
 * the pieces reach each other at all.
 *
 * The outcomes AFTER creation live in `createSheetOutcomes.test.ts`, split out when this crossed the
 * 200 line limit.
 *
 * COVERS: each verdict reaching its own screen, and the two-step party then owner flow.
 * MISSES: whether Foundry accepts the created document. The live harness owns that, on pf2e rather
 *   than the sf2e this was designed against.
 */
beforeEach(() => {
  document.body.innerHTML = '';
});

describe('when there is nothing to create in', () => {
  /**
   * ⚠️ THE TWO MESSAGES MUST DIFFER. "No parties" invites making one. "Not allowed" says ask your GM.
   * Showing the first when the truth is the second sends somebody looking for a party that already
   * exists and that they cannot use.
   */
  it('tells a GM with no parties that none exist', () => {
    beginCreateSheet(ports({ readParties: () => [] }));

    expect(screenText()).toContain('Ask your GM to make one');
  });

  it('tells a player who may not create something different', () => {
    beginCreateSheet(ports({ readParties: () => [party('Closed')], readViewer: () => PLAYER }));

    expect(screenText()).toContain('not opened any party');
    expect(screenText()).not.toContain('Ask your GM to make one');
  });
});

describe('choosing a party', () => {
  it('asks which party when there is more than one', () => {
    beginCreateSheet(ports({ readParties: () => [party('Alpha'), party('Beta')] }));

    expect(screenText()).toContain('Which party?');
    expect(rows().map((r) => r.textContent)).toEqual(['Alpha', 'Beta']);
  });

  /** A picker of one is a tap to reach a tap, which is what this module exists to remove. */
  it('skips straight past a single party to choosing an owner', () => {
    beginCreateSheet(ports({ readViewer: () => GM }));

    expect(screenText()).toContain('Whose character?');
  });

  /**
   * ⚠️ THE JOIN BETWEEN THE TWO STEPS, which each step's own test cannot see. Tapping a party has to
   * lead somewhere: a picker that closes onto nothing is indistinguishable from a tap that missed.
   */
  it('moves on to choosing an owner once a party is tapped', () => {
    beginCreateSheet(ports({ readParties: () => [party('Alpha'), party('Beta')] }));

    rows()
      .find((r) => r.textContent === 'Beta')
      ?.click();

    expect(screenText()).toContain('Whose character?');
  });
});

describe('when there is nobody to own it', () => {
  /** ⚠️ Rare, but silence here would be a button that visibly does nothing at all. */
  it('says so rather than leaving the tap unanswered', () => {
    beginCreateSheet(ports({ readUsers: () => [] }));

    expect(screenText()).toContain('no user to give this character to');
  });
});

describe('choosing an owner', () => {
  it('offers a GM everybody', () => {
    beginCreateSheet(ports());

    expect(rows().map((r) => r.textContent)).toEqual(['Gamemaster', 'Ana']);
  });

  /**
   * ⚠️ A player is never asked. `assignableUsers` cuts their list to themselves, so the flow creates
   * immediately: offering a choice of one would be a tap for no decision.
   */
  it('never asks a player, and creates for them directly', async () => {
    const create = vi.fn(async () =>
      Promise.resolve({ kind: 'created' as const, sheet: { uuid: 'Actor.new' } })
    );
    beginCreateSheet(ports({ readParties: () => [openParty()], readViewer: () => PLAYER, create }));
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalled();
    });

    expect(create).toHaveBeenCalledWith({
      name: DEFAULT_SHEET_NAME,
      ownerId: 'p1',
      partyUuid: 'Actor.Open',
    });
  });

  it('creates for the user whose row was tapped', async () => {
    const create = vi.fn(async () =>
      Promise.resolve({ kind: 'created' as const, sheet: { uuid: 'Actor.new' } })
    );
    beginCreateSheet(ports({ create }));

    rows()
      .find((r) => r.textContent === 'Ana')
      ?.click();
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalled();
    });

    expect(create).toHaveBeenCalledWith({
      name: DEFAULT_SHEET_NAME,
      ownerId: 'p1',
      partyUuid: 'Actor.Alpha',
    });
  });
});
