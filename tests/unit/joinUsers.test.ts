import { describe, expect, it } from 'vitest';

import {
  buildJoinBody,
  describeMissingUser,
  resolveUserId,
} from '../../scripts/foundry/joinUsers.ts';

/**
 * Turning a user's name into the id Foundry's /join wants.
 *
 * ⚠️ Every value here was MEASURED against a live 14.366 on 2026-08-14, not inferred from the
 * release notes. The notes say only that user selection "becomes a text input with autocompletion",
 * which is true and does not mention the part that actually broke the harness: the POST key changed
 * from `userid` to `userId`.
 *
 * The old key is not rejected, it is ignored, so the server sees a request with no user and answers
 * `JOIN.ErrorUserDoesNotExist` - which reads as "your world has no such user" about a user who is
 * plainly there.
 */
const USERS = [
  { id: '7PaKtYhGyjFH11Zw', name: 'Gamemaster' },
  { id: 'D4xzLfGkHTT8iQAl', name: 'Anthony' },
  { id: '76l2pAZqlFe2O3Sh', name: 'Horia' },
];

describe('resolving a user id', () => {
  it('finds the id for a name', () => {
    expect(resolveUserId(USERS, 'Gamemaster')).toBe('7PaKtYhGyjFH11Zw');
  });

  /**
   * ⚠️ 14.366's field is FREE TEXT rather than a list to pick from, so a capitalisation nobody would
   * notice is now a way to fail. FOUNDRY_USER is typed by a human into a shell.
   */
  it('ignores casing and surrounding space', () => {
    expect(resolveUserId(USERS, '  gameMASTER ')).toBe('7PaKtYhGyjFH11Zw');
  });

  it('returns null for a name the world does not have', () => {
    expect(resolveUserId(USERS, 'Nobody')).toBeNull();
  });
});

/** An empty list and a wrong name are different findings and must not read the same. */
describe('when the user cannot be found', () => {
  it('lists what the world offers when the name is simply wrong', () => {
    const described = describeMissingUser(USERS, 'Nobody');

    expect(described).toContain("no user named 'Nobody'");
    expect(described).toContain('Gamemaster, Anthony, Horia');
  });

  it('says the list itself could not be read when it is empty', () => {
    const described = describeMissingUser([], 'Gamemaster');

    expect(described).toContain('could not read any users');
    expect(described).toContain('game.users');
    expect(described).not.toContain('no user named');
  });
});

/**
 * ⚠️ BOTH spellings, and this is the test that matters. 14.366 reads `userId`; 14.365 reads
 * `userid`. Neither complains about the other, so sending both makes the harness work either side of
 * an upgrade without having to ask the server which it is.
 *
 * Measured: with only `userid`, a live 14.366 answered `JOIN.ErrorUserDoesNotExist` for a user that
 * exists. With both, the same request reached `JOIN.ErrorInvalidPassword` - the user resolved and
 * only the credential was missing.
 */
describe('the join payload', () => {
  it('carries the id under both spellings', () => {
    const body = buildJoinBody('7PaKtYhGyjFH11Zw', 'Gamemaster', 'secret');

    expect(body.userId).toBe('7PaKtYhGyjFH11Zw');
    expect(body.userid).toBe('7PaKtYhGyjFH11Zw');
  });

  /** 14.366's own form sends the username alongside the id, so this matches what Foundry does. */
  it('sends the username and action the real form sends', () => {
    const body = buildJoinBody('abc', 'Gamemaster', 'secret');

    expect(body).toEqual({
      action: 'join',
      userId: 'abc',
      userid: 'abc',
      username: 'Gamemaster',
      password: 'secret',
    });
  });
});
