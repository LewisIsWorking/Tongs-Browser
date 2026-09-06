import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildRequestProof } from '../../src/relay/BuildRequestProof.js';
import { MODULE_ID } from '../../src/constants.js';
import { CLAIM_FLAG } from '../../src/relay/RequestProof.js';
import { clearFoundry, globals } from './support/creationRelayGlobals.js';

/**
 * The real Foundry behind the sender proof. Written 2026-09-06.
 *
 * COVERS: every path through the three ports, including the ones a world in a bad state takes.
 * MISSES: that Foundry's server actually refuses a player writing a flag to another user. That is
 *   read from 14.366's shipped source in `RequestProof`'s docblock and cannot be established here:
 *   these fakes obey the rule because they were written to, which is an assumption, not evidence.
 */
afterEach(clearFoundry);

describe('claiming', () => {
  /** ⚠️ Writes to `game.user`, THIS client's own. There is no path here that names another user. */
  it('writes the request id onto this client’s own user', async () => {
    const setFlag = vi.fn(async () => Promise.resolve(undefined));
    globals['game'] = { user: { setFlag } };

    await buildRequestProof().claim('req-1');

    expect(setFlag).toHaveBeenCalledWith(MODULE_ID, CLAIM_FLAG, 'req-1');
  });

  /**
   * ⚠️ Harmless before Foundry is ready. `buildCreationRelay` is constructed at module setup and
   * reads globals lazily, so a claim can be attempted against a world that has no `game` yet.
   * Throwing here would take the tap down with it.
   */
  it('does nothing when there is no game or user', async () => {
    globals['game'] = undefined;
    await expect(buildRequestProof().claim('req-1')).resolves.toBeUndefined();

    globals['game'] = {};
    await expect(buildRequestProof().claim('req-1')).resolves.toBeUndefined();
  });
});

describe('reading a claim', () => {
  it('returns the id the named user is claiming', () => {
    globals['game'] = { users: { get: () => ({ getFlag: () => 'req-1' }) } };

    expect(buildRequestProof().readClaim('user-1')).toBe('req-1');
  });

  /**
   * ⛔ A flag is ordinary document data and a hostile client may put anything there. Coercing with
   * `String(claimed)` would turn `{}` into "[object Object]", which is a value that could match
   * another forged one. Anything that is not a string is no claim at all.
   */
  it('returns null for a claim that is not a string', () => {
    for (const value of [42, {}, [], true, null, undefined]) {
      globals['game'] = { users: { get: () => ({ getFlag: () => value }) } };
      expect(buildRequestProof().readClaim('user-1')).toBeNull();
    }
  });

  /** ⚠️ An unknown user claims nothing, which refuses. Failing closed is the whole point. */
  it('returns null when the user is not there', () => {
    globals['game'] = { users: { get: () => undefined } };
    expect(buildRequestProof().readClaim('nobody')).toBeNull();

    globals['game'] = {};
    expect(buildRequestProof().readClaim('nobody')).toBeNull();

    globals['game'] = undefined;
    expect(buildRequestProof().readClaim('nobody')).toBeNull();
  });
});

describe('releasing a claim', () => {
  /** ⚠️ Against the REQUESTER's document, from the GM's client, which a full GM is allowed to do. */
  it('clears the flag on the named user', async () => {
    const unsetFlag = vi.fn(async () => Promise.resolve(undefined));
    globals['game'] = { users: { get: () => ({ unsetFlag }) } };

    await buildRequestProof().release('user-1');

    expect(unsetFlag).toHaveBeenCalledWith(MODULE_ID, CLAIM_FLAG);
  });

  /**
   * ⚠️ Harmless when the user has gone. A player can disconnect between asking and being served, and
   * a release that threw would take the GM's answer down with it, turning a served request into a
   * timeout for somebody who is no longer there to care.
   */
  it('does nothing when the user is not there', async () => {
    globals['game'] = { users: { get: () => undefined } };
    await expect(buildRequestProof().release('nobody')).resolves.toBeUndefined();

    globals['game'] = undefined;
    await expect(buildRequestProof().release('nobody')).resolves.toBeUndefined();
  });
});
