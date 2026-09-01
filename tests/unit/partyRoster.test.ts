import { describe, expect, it } from 'vitest';

import {
  assignableUsers,
  creatableParties,
  decideCreation,
  type AssignableUser,
  type PartyCandidate,
} from '../../src/foundry/PartyRoster.js';

/**
 * Who may create a sheet, where, and for whom. Written 2026-09-01.
 *
 * ⚠️ Every rule here is a permission rule, so a wrong answer is not a cosmetic bug. The two that
 * would be invisible in use:
 *
 * - a player offered a party whose GM never switched creation on
 * - a player offered a user other than themselves, which Foundry accepts and then SILENTLY discards
 *   on create, handing the sheet to nobody
 *
 * COVERS: the flag test, the self-only rule, and the four shapes the button has to take.
 * MISSES: whether Foundry sent the client a party at all. That is the server's filter, and this is
 *   deliberately the second line rather than the first.
 */
const party = (name: string, over: Partial<PartyCandidate> = {}): PartyCandidate => ({
  uuid: `Actor.${name}`,
  name,
  isOwner: false,
  playerCreationEnabled: false,
  ...over,
});

const GM = { isGm: true, id: 'gm1' };
const PLAYER = { isGm: false, id: 'p1' };

describe('which parties a user may create in', () => {
  it('offers a GM every party they can see', () => {
    const parties = [party('Alpha'), party('Beta')];

    expect(creatableParties(parties, GM).map((p) => p.name)).toEqual(['Alpha', 'Beta']);
  });

  /** ⚠️ Requirement 2: the flag is the authorisation, and it is per party rather than global. */
  it('offers a player only the parties whose flag is on', () => {
    const parties = [party('Open', { playerCreationEnabled: true }), party('Closed')];

    expect(creatableParties(parties, PLAYER).map((p) => p.name)).toEqual(['Open']);
  });

  it('offers a player nothing when no party has the flag', () => {
    expect(creatableParties([party('Closed'), party('Also closed')], PLAYER)).toEqual([]);
  });

  /**
   * ⚠️ Owning the party is NOT the test, on purpose. "May edit this party" and "may add new
   * characters to it" have to stay separate, or the switch cannot be turned off for anyone who
   * already had edit rights.
   */
  it('does not let owning a party stand in for the flag', () => {
    const parties = [party('Mine', { isOwner: true })];

    expect(creatableParties(parties, PLAYER)).toEqual([]);
  });
});

describe('who a sheet may be assigned to', () => {
  const users: AssignableUser[] = [
    { id: 'gm1', name: 'Gamemaster', isGm: true },
    { id: 'p1', name: 'Ana', isGm: false },
    { id: 'p2', name: 'Ben', isGm: false },
  ];

  it('lets a GM assign to anyone', () => {
    expect(assignableUsers(users, GM).map((u) => u.name)).toEqual(['Gamemaster', 'Ana', 'Ben']);
  });

  /**
   * ⚠️ MEASURED, not chosen. Foundry's `sanitizeDocumentOwnershipField` silently deletes an ownership
   * entry naming anyone but the creator when a document is created. A picker offering Ben to Ana
   * would look like it worked and hand the sheet to nobody, surfacing days later as "why can't I open
   * my character". Offering a choice that cannot be honoured is worse than offering none.
   */
  it('lets a player assign only to themselves', () => {
    expect(assignableUsers(users, PLAYER).map((u) => u.name)).toEqual(['Ana']);
  });
});

describe('what the create button should do', () => {
  it('asks which party when there is more than one', () => {
    const verdict = decideCreation([party('A'), party('B')], GM);

    expect(verdict.kind).toBe('choose');
    expect(verdict.kind === 'choose' ? verdict.parties.length : 0).toBe(2);
  });

  /** A picker of one row is a tap to reach a tap, which is what this module exists to remove. */
  it('skips the picker when there is exactly one', () => {
    const verdict = decideCreation([party('Only')], GM);

    expect(verdict).toEqual({ kind: 'onlyParty', party: party('Only') });
  });

  it('says there are no parties when the world has none', () => {
    expect(decideCreation([], GM)).toEqual({ kind: 'noParties' });
  });

  /**
   * ⚠️ NOT THE SAME ANSWER, and collapsing the two would be worse than having no button. "There are
   * no parties here" invites making one. "You may not create sheets" tells a player to ask their GM.
   * Reporting the first when the truth is the second sends somebody looking for a party that already
   * exists and that they simply cannot use.
   */
  it('tells a player they are not allowed, rather than that nothing exists', () => {
    expect(decideCreation([party('Closed')], PLAYER)).toEqual({ kind: 'notAllowed' });
  });

  it('still says nothing exists when a player faces an empty world', () => {
    expect(decideCreation([], PLAYER)).toEqual({ kind: 'noParties' });
  });
});
