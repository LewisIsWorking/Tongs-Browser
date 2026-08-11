import { describe, expect, it, vi } from 'vitest';

import { PauseRelay, type SocketLike } from '../../src/relay/PauseRelay.js';

const CHANNEL = 'module.tongs-browser';

function fakeSocket(): SocketLike & {
  handlers: Map<string, ((payload: unknown) => void)[]>;
  emitted: { event: string; payload: unknown }[];
} {
  const handlers = new Map<string, ((payload: unknown) => void)[]>();
  const emitted: { event: string; payload: unknown }[] = [];
  return {
    handlers,
    emitted,
    on(event, handler) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    off(event, handler) {
      handlers.set(
        event,
        (handlers.get(event) ?? []).filter((h) => h !== handler)
      );
    },
    emit(event, payload) {
      emitted.push({ event, payload });
    },
  };
}

/** Deliver a payload to whatever the relay registered, as the server would to every client. */
function deliver(socket: ReturnType<typeof fakeSocket>, payload: unknown): void {
  for (const handler of socket.handlers.get(CHANNEL) ?? []) {
    handler(payload);
  }
}

function relay(options: {
  socket?: SocketLike | null;
  isDesignatedGm?: boolean;
  paused?: boolean;
  applyPause?: (pause: boolean) => void;
}) {
  const applyPause = options.applyPause ?? vi.fn();
  const subject = new PauseRelay({
    socket: options.socket === undefined ? fakeSocket() : options.socket,
    channel: CHANNEL,
    isDesignatedGm: () => options.isDesignatedGm ?? false,
    applyPause,
    getPaused: () => options.paused ?? false,
  });
  return { subject, applyPause };
}

/**
 * The whole reason this class exists.
 *
 * Foundry's Game#togglePause only broadcasts `if (options.broadcast && game.user.isGM)`, so the
 * permission check is on the EMIT path rather than the caller: a player calling it toggles their own
 * client and nobody else. Macro ownership does not help, because Macro#execute runs client side as
 * whoever pressed it and core Foundry has no execute-as-GM at all, verified against 14.365 source.
 */
describe('PauseRelay', () => {
  it('sends a request rather than pausing locally when the user is not a GM', () => {
    const socket = fakeSocket();
    const { subject, applyPause } = relay({ socket, isDesignatedGm: false, paused: false });

    subject.request();

    expect(applyPause).not.toHaveBeenCalled();
    expect(socket.emitted).toEqual([
      { event: CHANNEL, payload: { action: 'togglePause', pause: true } },
    ]);
  });

  /**
   * The request carries the DESIRED state, not the word "toggle". Two players tapping at the same
   * moment should agree on an outcome rather than cancel each other out.
   */
  it('carries the desired state, so simultaneous requests agree rather than cancel', () => {
    const socket = fakeSocket();
    const { subject } = relay({ socket, isDesignatedGm: false, paused: true });

    subject.request();

    expect(socket.emitted[0]?.payload).toEqual({ action: 'togglePause', pause: false });
  });

  it('applies directly when this client is the designated GM, without a round trip', () => {
    const socket = fakeSocket();
    const { subject, applyPause } = relay({ socket, isDesignatedGm: true, paused: false });

    subject.request();

    expect(applyPause).toHaveBeenCalledWith(true);
    expect(socket.emitted).toEqual([]);
  });

  it('still works for a solo GM with no socket at all', () => {
    const { subject, applyPause } = relay({ socket: null, isDesignatedGm: true, paused: true });

    subject.request();

    expect(applyPause).toHaveBeenCalledWith(false);
  });

  it('performs the toggle when a request arrives and this client is the designated GM', () => {
    const socket = fakeSocket();
    const { subject, applyPause } = relay({ socket, isDesignatedGm: true });
    subject.bind();

    deliver(socket, { action: 'togglePause', pause: true });

    expect(applyPause).toHaveBeenCalledWith(true);
  });

  /**
   * ⛔ The guard that stops the feature being worse than useless. Every client receives the socket
   * message, so without this each connected GM would perform the toggle and the state would flip
   * once per GM, landing wherever the race left it.
   */
  it('ignores a request when this client is not the designated GM', () => {
    const socket = fakeSocket();
    const { subject, applyPause } = relay({ socket, isDesignatedGm: false });
    subject.bind();

    deliver(socket, { action: 'togglePause', pause: true });

    expect(applyPause).not.toHaveBeenCalled();
  });

  it.each([
    null,
    undefined,
    42,
    'pause',
    {},
    { action: 'togglePause' },
    { action: 'other', pause: true },
  ])('ignores the malformed payload %s rather than acting on it', (payload) => {
    const socket = fakeSocket();
    const { subject, applyPause } = relay({ socket, isDesignatedGm: true });
    subject.bind();

    deliver(socket, payload);

    expect(applyPause).not.toHaveBeenCalled();
  });

  it('stops listening after unbind', () => {
    const socket = fakeSocket();
    const { subject, applyPause } = relay({ socket, isDesignatedGm: true });
    subject.bind();
    subject.unbind();

    deliver(socket, { action: 'togglePause', pause: true });

    expect(applyPause).not.toHaveBeenCalled();
    expect(subject.isBound()).toBe(false);
  });

  it('binds only once even if bind is called repeatedly', () => {
    const socket = fakeSocket();
    const { subject, applyPause } = relay({ socket, isDesignatedGm: true });
    subject.bind();
    subject.bind();
    subject.bind();

    deliver(socket, { action: 'togglePause', pause: true });

    expect(applyPause).toHaveBeenCalledOnce();
  });
});
