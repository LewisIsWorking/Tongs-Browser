import { describe, expect, it, vi } from 'vitest';

import { describePartyAccess, setPlayerCreation } from '../../src/foundry/PartyFlag.js';
import type { PartyCandidate } from '../../src/foundry/PartyRoster.js';

/**
 * Switching player creation on or off for one party. Written 2026-09-02.
 *
 * ⚠️ The WRITE half of a flag that could already be read. Until this existed the rule "players may
 * create where the GM has allowed it" had no way to opt in: every party was closed, permanently, and
 * the only symptom would have been a player told to ask their GM by a GM with no way to say yes.
 *
 * COVERS: writing the value asked for, and each way the write can fail.
 * MISSES: whether Foundry accepts the flag. The live harness owns that, and on pf2e rather than the
 *   sf2e this was designed against.
 */
const party = (over: Partial<PartyCandidate> = {}): PartyCandidate => ({
  uuid: 'Actor.p',
  name: 'The Firebrands',
  isOwner: false,
  playerCreationEnabled: false,
  ...over,
});

describe('opening a party to players', () => {
  it('writes the flag in this module scope', async () => {
    const setFlag = vi.fn(async () => Promise.resolve());
    const outcome = await setPlayerCreation('Actor.p', true, {
      resolveParty: async () => Promise.resolve({ setFlag }),
    });

    expect(setFlag).toHaveBeenCalledWith('tongs-browser', 'allowPlayerCreation', true);
    expect(outcome).toEqual({ kind: 'set', enabled: true });
  });

  it('can close a party again', async () => {
    const setFlag = vi.fn(async () => Promise.resolve());

    await setPlayerCreation('Actor.p', false, {
      resolveParty: async () => Promise.resolve({ setFlag }),
    });

    expect(setFlag).toHaveBeenCalledWith('tongs-browser', 'allowPlayerCreation', false);
  });

  /**
   * ⚠️ Writes what it was GIVEN, never a toggle computed from what it read. A toggle here would be a
   * read-modify-write across a network: two GMs tapping at once, or one GM tapping twice on a slow
   * connection, and the party lands in whichever state the race left it.
   */
  it('writes the value asked for even when it matches what is already there', async () => {
    const setFlag = vi.fn(async () => Promise.resolve());

    await setPlayerCreation('Actor.p', true, {
      resolveParty: async () => Promise.resolve({ setFlag }),
    });

    expect(setFlag).toHaveBeenCalledWith('tongs-browser', 'allowPlayerCreation', true);
  });

  it('looks up the party it was told to', async () => {
    const resolveParty = vi.fn(async () =>
      Promise.resolve({ setFlag: async () => Promise.resolve() })
    );

    await setPlayerCreation('Actor.other', true, { resolveParty });

    expect(resolveParty).toHaveBeenCalledWith('Actor.other');
  });

  /** ⚠️ A party deleted between opening the picker and tapping a row is an ordinary race, not a bug. */
  it('says so when the party is no longer there', async () => {
    const outcome = await setPlayerCreation('Actor.gone', true, {
      resolveParty: async () => Promise.resolve(null),
    });

    expect(outcome).toEqual({ kind: 'failed', reason: 'That party is no longer there.' });
  });

  it('says so when the document cannot carry a flag', async () => {
    const outcome = await setPlayerCreation('Actor.p', true, {
      resolveParty: async () => Promise.resolve({}),
    });

    expect(outcome.kind).toBe('failed');
  });

  /**
   * ⚠️ A thrown non-Error must not reach the user as `[object Object]`.
   *
   * The lint rule below is disabled only here, and on purpose. It exists to stop production code
   * rejecting with a non-Error, which is exactly the badly behaved caller this stands in for: Foundry
   * and its systems are somebody else's code, and "it always throws an Error" is not a promise this
   * module gets to rely on.
   */
  it('describes a thrown non-error readably', async () => {
    const outcome = await setPlayerCreation('Actor.p', true, {
      resolveParty: async () =>
        Promise.resolve({
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          setFlag: async () => Promise.reject('the server said no'),
        }),
    });

    expect(outcome).toEqual({ kind: 'failed', reason: 'the server said no' });
  });

  /** ⚠️ The reason travels. Foundry refusing a player's write is the case this most needs to explain. */
  it('reports the reason a refused write gave', async () => {
    const outcome = await setPlayerCreation('Actor.p', true, {
      resolveParty: async () =>
        Promise.resolve({
          setFlag: async () => Promise.reject(new Error('User lacks permission')),
        }),
    });

    expect(outcome).toEqual({ kind: 'failed', reason: 'User lacks permission' });
  });
});

describe('how a party reads in the access list', () => {
  /**
   * ⚠️ Names the STATE, not the action. "Open to players" says what is true; "Open this party" says
   * what a tap does and leaves the current state to be guessed. On a list where some rows are on and
   * some are off, only the first can be read at a glance, and reading at a glance is the point of a
   * list.
   */
  it('says a party is open when it is', () => {
    expect(describePartyAccess(party({ playerCreationEnabled: true }))).toBe(
      'The Firebrands: players may add characters'
    );
  });

  it('says a party is closed when it is', () => {
    expect(describePartyAccess(party())).toBe('The Firebrands: closed to players');
  });

  it('always names the party, so two rows are never identical', () => {
    const open = describePartyAccess(party({ name: 'Alpha', playerCreationEnabled: true }));
    const closed = describePartyAccess(party({ name: 'Beta' }));

    expect(open).toContain('Alpha');
    expect(closed).toContain('Beta');
  });
});
