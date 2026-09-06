import type { SocketLike } from './PauseRelay.js';

/**
 * Subscribing to a channel, once, and being able to stop. Extracted 2026-09-06 from `CreationRelay`
 * and `PauseRelay`, which had carried the identical `bound` flag, `bind`, `unbind` and `isBound`
 * since the second relay was written.
 *
 * ⚠️ The socket is read through a FUNCTION, never captured. `BuildCreationRelay` exposes it as a
 * getter for a reason: `game.socket` does not exist yet when the module is constructed, and a
 * binding holding the value it saw at startup would bind to `null` forever.
 *
 * ⚠️ Binding TWICE must not subscribe twice. Foundry calls `ready` once, but a relay is also bound
 * from tests and from re-enable, and a doubly bound handler serves every request twice: for the
 * creation relay that is two character sheets for one tap.
 *
 * ⚠️ Unbinding something never bound must be harmless. Teardown runs on paths setup did not, and a
 * relay that throws on the way out takes the rest of the teardown with it.
 */
export class SocketBinding {
  private bound = false;

  public constructor(
    private readonly socket: () => SocketLike | null,
    private readonly channel: string,
    private readonly handler: (payload: unknown) => void
  ) {}

  public bind(): void {
    const socket = this.socket();
    if (this.bound || socket === null) {
      return;
    }
    socket.on(this.channel, this.handler);
    this.bound = true;
  }

  /**
   * ⚠️ `off` is OPTIONAL on `SocketLike`, so this cannot assume it exists. A socket that cannot
   * unsubscribe still gets its flag cleared, which is the honest half of the job: the relay stops
   * acting even where the transport will not stop delivering.
   */
  public unbind(): void {
    const socket = this.socket();
    if (!this.bound || socket === null) {
      return;
    }
    socket.off?.(this.channel, this.handler);
    this.bound = false;
  }

  public isBound(): boolean {
    return this.bound;
  }
}
