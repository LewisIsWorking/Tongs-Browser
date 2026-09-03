import { vi } from 'vitest';

import type { CreationRelayOptions } from '../../../src/relay/CreationRelay.js';
import type { SocketLike } from '../../../src/relay/PauseRelay.js';

/**
 * A table with a socket everybody shares. Written 2026-09-03.
 *
 * ⚠️ The fake socket BROADCASTS to every handler, including the emitter's own, because that is what
 * Foundry does. A fake that delivered only to "the other client" would quietly hide the two bugs this
 * relay is shaped around: three GMs each serving the same request, and a player resolving on somebody
 * else's answer. A convenient fake would make both untestable.
 */
export class TestSocket implements SocketLike {
  private readonly handlers = new Map<string, ((payload: unknown) => void)[]>();
  public readonly sent: unknown[] = [];

  public on(event: string, handler: (payload: unknown) => void): void {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
  }

  public off(event: string, handler: (payload: unknown) => void): void {
    this.handlers.set(
      event,
      (this.handlers.get(event) ?? []).filter((h) => h !== handler)
    );
  }

  public emit(event: string, payload: unknown): void {
    this.sent.push(payload);
    for (const handler of [...(this.handlers.get(event) ?? [])]) {
      handler(payload);
    }
  }
}

export const CHANNEL = 'module.tongs-browser';

/** This client is the one GM that should act. */
export const AS_DESIGNATED_GM = { online: true, name: 'The GM', isMe: true };
/** A GM is out there, but it is not me. Covers a player and a non-designated GM alike. */
export const AS_PLAYER = { online: true, name: 'The GM', isMe: false };
export const NO_GM = { online: false, name: null, isMe: false };

export const OPEN_PARTY = {
  uuid: 'Actor.Open',
  name: 'The Open Party',
  isOwner: false,
  playerCreationEnabled: true,
};

/**
 * ⚠️ Timers run IMMEDIATELY only when a test asks. The default keeps the handle and never fires, so a
 * test that means to check the happy path cannot accidentally be measuring a timeout.
 */
export function manualTimers(): {
  ports: CreationRelayOptions['timers'];
  fire: () => void;
  cleared: () => number;
} {
  let pending: (() => void) | null = null;
  let cleared = 0;
  return {
    ports: {
      setTimer: (run) => {
        pending = run;
        return 'timer-handle';
      },
      clearTimer: () => {
        cleared += 1;
      },
      timeoutMs: 5000,
    },
    fire: () => {
      pending?.();
    },
    cleared: () => cleared,
  };
}

export function relayOptions(over: Partial<CreationRelayOptions> = {}): CreationRelayOptions {
  return {
    socket: new TestSocket(),
    channel: CHANNEL,
    readPresence: () => ({ online: true, name: 'The GM', isMe: false }),
    myUserId: () => 'user-player',
    readWorld: () => ({
      parties: [OPEN_PARTY],
      users: [
        { id: 'user-player', name: 'Ana', isGm: false },
        { id: 'user-gm', name: 'The GM', isGm: true },
      ],
    }),
    create: vi.fn(async () => Promise.resolve({ ok: true, actorUuid: 'Actor.New' })),
    newRequestId: () => 'req-1',
    timers: manualTimers().ports,
    ...over,
  };
}
