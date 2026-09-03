import { describe, expect, it } from 'vitest';

import { isCreationResult } from '../../src/relay/CreationResult.js';

/**
 * The shape check on the answer coming back. Written 2026-09-03.
 *
 * ⚠️ Checked as carefully as the request, and it is easy to argue it should not be: this looks like
 * "our own message coming home". It is not. It arrives at a PLAYER's client off a broadcast channel
 * any client can emit on, so a malformed or hostile payload would otherwise decide what a player is
 * told happened to their own character sheet.
 *
 * COVERS: every field wrong or missing, and the two optional fields being absent versus mistyped.
 * MISSES: whether the sender is the GM. Core Foundry does not say, and no shape check can.
 */
const valid = {
  action: 'createSheetResult',
  requestId: 'req-1',
  ok: true,
  actorUuid: 'Actor.New',
};

describe('what it accepts', () => {
  it('accepts a success', () => {
    expect(isCreationResult(valid)).toBe(true);
  });

  it('accepts a refusal carrying a reason', () => {
    expect(
      isCreationResult({ action: 'createSheetResult', requestId: 'r', ok: false, reason: 'no' })
    ).toBe(true);
  });

  /** ⚠️ Both optional fields ABSENT is the ordinary shape of a bare answer, not a malformed one. */
  it('accepts an answer with neither optional field', () => {
    expect(isCreationResult({ action: 'createSheetResult', requestId: 'r', ok: true })).toBe(true);
  });
});

describe('what it rejects', () => {
  it.each([
    ['a different action', { ...valid, action: 'createSheet' }],
    ['no action', { ...valid, action: undefined }],
    ['no requestId', { ...valid, requestId: undefined }],
    ['an empty requestId', { ...valid, requestId: '' }],
    ['a requestId that is not a string', { ...valid, requestId: 7 }],
    ['no ok', { ...valid, ok: undefined }],
    ['an ok that is not a boolean', { ...valid, ok: 'yes' }],
    /*
     * ⚠️ A wrong TYPE is rejected even though the field is optional. A number arriving as `reason`
     * would go straight into a message shown to a user, and `String(42)` reads as an explanation.
     */
    ['a reason that is not a string', { ...valid, reason: 42 }],
    ['an actorUuid that is not a string', { ...valid, actorUuid: 42 }],
  ])('rejects %s', (_label, payload) => {
    expect(isCreationResult(payload)).toBe(false);
  });

  /** ⚠️ `null` is an object in JavaScript, so it needs its own case rather than falling out of one. */
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'createSheetResult'],
    ['a number', 7],
  ])('rejects %s', (_label, payload) => {
    expect(isCreationResult(payload)).toBe(false);
  });
});
