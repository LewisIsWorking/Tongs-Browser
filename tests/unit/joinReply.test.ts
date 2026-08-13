import { describe, expect, it } from 'vitest';

import { interpretJoinReply } from '../../scripts/foundry/joinReply.ts';

/**
 * What the harness says when Foundry will not let it in.
 *
 * ⚠️ This suite exists because every live check in this repo died with
 * `SyntaxError: Unexpected token 'J', "JOIN.Error"... is not valid JSON`, and that was the entire
 * report. Foundry answers a refused join with a bare localization key rather than JSON, so calling
 * `res.json()` threw and discarded the server's actual complaint - which was sitting in the body the
 * parser had just been handed.
 *
 * A diagnostic is the one thing that must not be trusted untested: when it is wrong, it is wrong at
 * exactly the moment somebody is relying on it, and it sends them somewhere else entirely.
 */
describe('a join that succeeded', () => {
  it('says so, and says nothing else', () => {
    expect(interpretJoinReply({ status: 200, body: '{"status":"success"}' })).toEqual({
      kind: 'joined',
    });
  });
});

describe('a join Foundry refused in JSON', () => {
  it('quotes the message it was given', () => {
    const outcome = interpretJoinReply({
      status: 403,
      body: '{"status":"failed","message":"That user is already logged in."}',
    });

    expect(outcome).toEqual({ kind: 'refused', message: 'That user is already logged in.' });
  });

  /** A refusal with no message must still be a refusal, not a silent success. */
  it('falls back to the body when there is no message', () => {
    const outcome = interpretJoinReply({ status: 403, body: '{"status":"failed"}' });

    expect(outcome.kind).toBe('refused');
  });
});

/**
 * ⚠️ THE ACTUAL FAILURE, reproduced. This is the exact reply that killed every live harness:
 * HTTP 401 with the body `JOIN.ErrorInvalidPassword` and no JSON anywhere.
 */
describe('a refusal that is not JSON at all', () => {
  const refusal = { status: 401, body: 'JOIN.ErrorInvalidPassword' };

  it('reports it as a refusal rather than throwing', () => {
    expect(() => interpretJoinReply(refusal)).not.toThrow();
    expect(interpretJoinReply(refusal).kind).toBe('refused');
  });

  it('quotes what Foundry said, since that is the whole answer', () => {
    const outcome = interpretJoinReply(refusal);

    expect(outcome.kind === 'refused' && outcome.message).toContain('JOIN.ErrorInvalidPassword');
    expect(outcome.kind === 'refused' && outcome.message).toContain('401');
  });

  it('names the thing to actually do about it', () => {
    const outcome = interpretJoinReply(refusal);

    expect(outcome.kind === 'refused' && outcome.message).toContain('FOUNDRY_PASSWORD');
  });

  /**
   * ⚠️ The password hint is attached to Foundry's OWN refusals only. Offered indiscriminately it
   * would be noise, and the case where it is wrong is the interesting one: an HTML body means
   * something other than Foundry is answering on that port, and telling the operator to check their
   * password would send them looking at the wrong machine entirely.
   */
  it('does not blame the password when something else is answering the port', () => {
    const outcome = interpretJoinReply({
      status: 502,
      body: '<html><body>Bad Gateway</body></html>',
    });

    expect(outcome.kind === 'refused' && outcome.message).not.toContain('FOUNDRY_PASSWORD');
    expect(outcome.kind === 'refused' && outcome.message).toContain('other than Foundry');
  });

  /** These are read in a terminal, and an unbounded body from somebody else's server can be a page. */
  it('truncates a body too long to read', () => {
    const outcome = interpretJoinReply({ status: 500, body: 'x'.repeat(5000) });

    expect(outcome.kind === 'refused' && outcome.message.length).toBeLessThan(400);
  });
});
