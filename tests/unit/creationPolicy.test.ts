import { describe, expect, it } from 'vitest';

import { DEFAULT_NAME, authoriseCreation } from '../../src/relay/CreationPolicy.js';
import type { RequestWorld } from '../../src/relay/CreationPolicy.js';
import { NAME_LIMIT } from '../../src/relay/CreationRequest.js';
import type { CreationRequest } from '../../src/relay/CreationRequest.js';

/**
 * The GM-side authorisation for a player's create request. Written 2026-09-03.
 *
 * ⚠️ Every test here is a REFUSAL that matters, because this code runs on a GM's client where
 * Foundry refuses nothing. `sanitizeDocumentOwnershipField` returns the value untouched for a GM, so
 * the rule that normally stops a player granting ownership elsewhere is absent on this path. A gap
 * here is not "a check we forgot", it is the only check there was.
 *
 * COVERS: an unknown party, a closed party, an unknown user, a GM coming in the wrong way, and the
 *   name being cleaned rather than taken as sent.
 * MISSES: whether `userId` is who they say. It cannot be checked from here and the policy's docblock
 *   says so; core Foundry gives a socket receiver no authenticated sender.
 */
const OPEN = {
  uuid: 'Actor.Open',
  name: 'The Open Party',
  isOwner: false,
  playerCreationEnabled: true,
};
const CLOSED = {
  uuid: 'Actor.Closed',
  name: 'The Closed Party',
  isOwner: false,
  playerCreationEnabled: false,
};

const world = (over: Partial<RequestWorld> = {}): RequestWorld => ({
  parties: [OPEN, CLOSED],
  users: [
    { id: 'user-player', name: 'Ana', isGm: false },
    { id: 'user-gm', name: 'The GM', isGm: true },
  ],
  ...over,
});

const ask = (over: Partial<CreationRequest> = {}): CreationRequest => ({
  action: 'createSheet',
  requestId: 'req-1',
  userId: 'user-player',
  partyUuid: 'Actor.Open',
  name: 'Bramble',
  ...over,
});

describe('a request that should be honoured', () => {
  it('authorises a player creating in a party their GM opened', () => {
    const verdict = authoriseCreation(ask(), world());

    expect(verdict).toEqual({
      kind: 'authorised',
      ownerId: 'user-player',
      partyUuid: 'Actor.Open',
      name: 'Bramble',
    });
  });
});

describe('what it refuses', () => {
  /**
   * ⚠️ The permission is read from the GM's OWN copy of the party, never from the request. A request
   * carrying its own permission would be a request that granted itself, which is the whole attack.
   */
  it('refuses a party the GM has not opened to players', () => {
    const verdict = authoriseCreation(ask({ partyUuid: 'Actor.Closed' }), world());

    expect(verdict.kind).toBe('refused');
    expect(verdict).toHaveProperty('reason', expect.stringContaining('not open'));
  });

  it('refuses a party the GM cannot see, in the same words as one that does not exist', () => {
    const missing = authoriseCreation(ask({ partyUuid: 'Actor.Nowhere' }), world());
    const invisible = authoriseCreation(ask({ partyUuid: 'Actor.Hidden' }), world());

    expect(missing.kind).toBe('refused');
    expect(missing).toEqual(invisible);
  });

  /**
   * ⚠️ Without this the ownership entry would point at a user who does not exist, producing a sheet
   * whose owner cannot be found, granted or revoked by anybody.
   */
  it('refuses a user it does not recognise', () => {
    const verdict = authoriseCreation(ask({ userId: 'user-ghost' }), world());

    expect(verdict.kind).toBe('refused');
    expect(verdict).toHaveProperty('reason', expect.stringContaining('recognise'));
  });

  /**
   * ⚠️ Refused rather than served. A GM has the full picker, including the choice of owner; honouring
   * this would silently drop that choice and give them a sheet owned by themselves.
   */
  it('refuses a GM who came through the player path', () => {
    const verdict = authoriseCreation(ask({ userId: 'user-gm' }), world());

    expect(verdict.kind).toBe('refused');
    expect(verdict).toHaveProperty('reason', expect.stringContaining('directly'));
  });
});

describe('the name it accepts', () => {
  it('trims a name rather than storing the spaces', () => {
    const verdict = authoriseCreation(ask({ name: '  Bramble  ' }), world());

    expect(verdict).toHaveProperty('name', 'Bramble');
  });

  /** ⚠️ A blank name is a normal thing to send, not an error the user has to go and fix. */
  it('falls back to a default when the name is blank', () => {
    const verdict = authoriseCreation(ask({ name: '   ' }), world());

    expect(verdict).toHaveProperty('name', DEFAULT_NAME);
  });

  /**
   * ⚠️ Asserts the CAP, not merely that something was cut. A test that only checked the name changed
   * would pass for a policy that truncated to one character.
   */
  it('caps a name at the limit rather than writing an essay into the world', () => {
    const verdict = authoriseCreation(ask({ name: 'a'.repeat(NAME_LIMIT + 40) }), world());

    expect(verdict).toHaveProperty('name', 'a'.repeat(NAME_LIMIT));
  });
});
