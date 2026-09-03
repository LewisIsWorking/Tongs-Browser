import { describe, expect, it } from 'vitest';

import { isCreationRequest } from '../../src/relay/CreationRequest.js';

/**
 * The shape check on what arrives over the socket. Written 2026-09-03.
 *
 * ⚠️ This is a real boundary, not a formality. Any connected client can emit on a module's socket
 * channel, so everything crossing it is untrusted input, and the fields are read by code running on a
 * GM's client where Foundry refuses nothing.
 *
 * COVERS: each required field missing or the wrong type, and the deliberate exception for `name`.
 * MISSES: whether the sender is who they claim. Core Foundry does not say, and no shape check can.
 */
const valid = {
  action: 'createSheet',
  requestId: 'req-1',
  userId: 'user-player',
  partyUuid: 'Actor.Open',
  name: 'Bramble',
};

describe('what it accepts', () => {
  it('accepts a complete request', () => {
    expect(isCreationRequest(valid)).toBe(true);
  });

  /** ⚠️ An empty name is ACCEPTED and defaulted later. Rejecting it would turn a blank field into a
   * socket error the user has no way to act on. */
  it('accepts an empty name, which the policy defaults', () => {
    expect(isCreationRequest({ ...valid, name: '' })).toBe(true);
  });
});

describe('what it rejects', () => {
  it.each([
    ['a different action', { ...valid, action: 'togglePause' }],
    ['no action', { ...valid, action: undefined }],
    ['no requestId', { ...valid, requestId: undefined }],
    ['an empty requestId', { ...valid, requestId: '' }],
    ['no userId', { ...valid, userId: undefined }],
    ['an empty userId', { ...valid, userId: '' }],
    ['no partyUuid', { ...valid, partyUuid: undefined }],
    ['an empty partyUuid', { ...valid, partyUuid: '' }],
    ['a name that is not a string', { ...valid, name: 42 }],
    ['a userId that is not a string', { ...valid, userId: 42 }],
  ])('rejects %s', (_label, payload) => {
    expect(isCreationRequest(payload)).toBe(false);
  });

  /** ⚠️ `null` is an object in JavaScript, so it needs its own case rather than falling out of one. */
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'createSheet'],
    ['a number', 7],
    ['an array', []],
  ])('rejects %s', (_label, payload) => {
    expect(isCreationRequest(payload)).toBe(false);
  });
});
