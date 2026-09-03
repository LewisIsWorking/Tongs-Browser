import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCreationRelay } from '../../src/relay/BuildCreationRelay.js';
import {
  clearFoundry,
  globals,
  stubFoundryDocuments,
  world,
  type Emitted,
} from './support/creationRelayGlobals.js';

/**
 * What a request carries, and what happens when the answer arrives. Written 2026-09-03, split from
 * `buildCreationRelay.test.ts` at the 200 line limit.
 *
 * COVERS: the request id in both of its forms, the asker's identity, and a real settle.
 * MISSES: what the GM does with the request, which `creationRelay.test.ts` owns against fakes.
 */
beforeEach(stubFoundryDocuments);

afterEach(() => {
  clearFoundry();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the id a request travels under', () => {
  const askAsPlayer = (sent: Emitted[]): Emitted | undefined => {
    vi.useFakeTimers();
    void buildCreationRelay().request('Actor.p', 'Bramble');
    vi.runAllTimers();
    return sent[0];
  };

  /*
   * ⚠️ `vi.stubGlobal`, not assignment. `globalThis.crypto` is a non-writable accessor in jsdom, so
   * `globals['crypto'] = ...` fails SILENTLY and the test then measures the real implementation while
   * appearing to measure the stub. Both of these tests passed that way for the wrong reason first.
   */
  it('uses crypto.randomUUID when the page is a secure context', () => {
    const { sent } = world({ user: { id: 'p1', isGM: false } });
    vi.stubGlobal('crypto', { randomUUID: () => 'a-real-uuid' });

    expect(askAsPlayer(sent)?.requestId).toBe('a-real-uuid');
  });

  /**
   * ⚠️ The fallback carries the USER ID. Foundry over plain http on a LAN has no `randomUUID`, and
   * that is the ordinary way this module is reached from a phone. A bare counter would have two
   * clients both starting at one, colliding, and a player settling on somebody else's answer.
   */
  it('falls back to an id scoped by the user when randomUUID is missing', () => {
    const { sent } = world({ user: { id: 'p1', isGM: false } });
    vi.stubGlobal('crypto', {});

    expect(askAsPlayer(sent)?.requestId).toContain('p1');
  });

  it('sends the asker’s own id rather than anything from a payload', () => {
    const { sent } = world({ user: { id: 'p1', isGM: false } });

    expect(askAsPlayer(sent)?.userId).toBe('p1');
  });

  /**
   * ⚠️ Still produces an id when Foundry has not said who this client is. The alternative is an empty
   * segment, so two anonymous clients would generate the SAME id and settle on each other's answers.
   * The request is refused by the policy anyway, but an id that can collide is worth not minting.
   */
  it('still makes a distinct id when there is no user yet', () => {
    const { sent } = world({ user: undefined });
    vi.stubGlobal('crypto', {});

    expect(askAsPlayer(sent)?.requestId).toContain('anon');
  });

  /**
   * ⚠️ An EMPTY asker rather than a missing field, and the difference is what the GM does with it.
   * `CreationPolicy` looks the id up in the user list and refuses what it cannot find, so an empty
   * string is refused; a missing field would fail the shape check before that and be dropped in
   * silence, which is the same outcome with no explanation attached to it.
   */
  it('sends an empty asker when Foundry has not said who this client is', () => {
    const { sent } = world({ user: undefined });

    expect(askAsPlayer(sent)?.userId).toBe('');
  });
});

describe('when an answer comes back', () => {
  /**
   * ⚠️ Drives the REAL timer ports, which nothing else reaches: every other test either resolves with
   * no round trip or lets the timeout fire. A `clearTimer` wired wrongly would leave a timer running
   * after an answer arrived and, against a real Foundry, later report "nobody answered" over a request
   * that had already succeeded.
   */
  it('resolves the waiting request and stops its clock', async () => {
    let handler: ((payload: unknown) => void) | undefined;
    const sent: Emitted[] = [];
    globals['game'] = {
      user: { id: 'p1', isGM: false },
      users: Object.assign([{ id: 'p1', name: 'Ana', isGM: false }], {
        activeGM: { id: 'gm1', name: 'The GM' },
      }),
      actors: [],
      socket: {
        on: (_event: string, fn: (payload: unknown) => void) => {
          handler = fn;
        },
        off: () => undefined,
        emit: (_event: string, payload: Emitted) => sent.push(payload),
      },
    };

    const relay = buildCreationRelay();
    relay.bind();
    const waiting = relay.request('Actor.p', 'Bramble');

    handler?.({
      action: 'createSheetResult',
      requestId: sent[0]?.requestId,
      ok: true,
      actorUuid: 'Actor.new',
    });

    expect(await waiting).toEqual({ kind: 'created', actorUuid: 'Actor.new' });
    relay.unbind();
  });
});
