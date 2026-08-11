import type { Logger } from '../core/Logger.js';

/** The subset of Foundry's socket this needs. Narrow on purpose, so it is trivial to fake. */
export interface SocketLike {
  on(event: string, handler: (payload: unknown) => void): void;
  off?: (event: string, handler: (payload: unknown) => void) => void;
  emit(event: string, payload: unknown): void;
}

export interface PauseRelayOptions {
  /** Foundry's socket, or null when there is none, in which case only the local path is used. */
  readonly socket: SocketLike | null;
  /** The socket channel. Foundry reserves `module.<id>` for a module's own traffic. */
  readonly channel: string;
  /**
   * Whether THIS client is the one GM that should act on a request.
   *
   * Not merely "am I a GM". With three GMs connected, every one of them would answer a request and
   * the pause state would flip three times, landing wherever the race left it. Foundry's
   * `game.users.activeGM` picks the same single user on every client, which is what makes this safe.
   */
  readonly isDesignatedGm: () => boolean;
  /** Performs the authoritative toggle. Only ever called on the designated GM's client. */
  readonly applyPause: (pause: boolean) => void;
  readonly getPaused: () => boolean;
  readonly logger?: Logger;
}

/** What travels over the wire. Kept minimal so an old client cannot be confused by a new field. */
interface PauseRequest {
  readonly action: 'togglePause';
  readonly pause: boolean;
}

function isPauseRequest(payload: unknown): payload is PauseRequest {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const candidate = payload as Partial<PauseRequest>;
  return candidate.action === 'togglePause' && typeof candidate.pause === 'boolean';
}

/**
 * Lets a player pause the game, by asking a GM to do it.
 *
 * ⚠️ Why this has to exist, because the obvious answers do not work and one of them is widely
 * repeated as if it does.
 *
 * Foundry's `Game#togglePause` only broadcasts `if (options.broadcast && game.user.isGM)`. The
 * permission check sits on the EMIT path, not on the caller, so a player calling it toggles their own
 * client and nobody else's. Macro ownership does not help either: `Macro#execute` runs the script
 * client side as whoever pressed it, and core Foundry has no "execute as GM" at all. Verified
 * against the installed 14.365 source rather than assumed: `executeAsGM`, `execute-as` and `asGM`
 * appear nowhere in client or common. That feature comes from modules such as Advanced Macros.
 *
 * So the player emits a request, and the one designated GM performs the toggle authoritatively. The
 * request carries the DESIRED state rather than "toggle", because two players tapping at once should
 * agree on an outcome rather than cancel each other out.
 */
export class PauseRelay {
  private bound = false;

  private readonly onSocket = (payload: unknown): void => {
    if (!isPauseRequest(payload)) {
      return;
    }
    // Everyone receives it; only the designated GM acts. Without this the state flips once per GM.
    if (!this.options.isDesignatedGm()) {
      return;
    }
    this.options.applyPause(payload.pause);
  };

  public constructor(private readonly options: PauseRelayOptions) {}

  public bind(): void {
    if (this.bound || this.options.socket === null) {
      return;
    }
    this.options.socket.on(this.options.channel, this.onSocket);
    this.bound = true;
  }

  public unbind(): void {
    if (!this.bound || this.options.socket === null) {
      return;
    }
    this.options.socket.off?.(this.options.channel, this.onSocket);
    this.bound = false;
  }

  public isBound(): boolean {
    return this.bound;
  }

  /**
   * Ask for the game to be paused or unpaused.
   *
   * A GM does it directly rather than emitting to itself, so it still works with no socket at all,
   * and so a solo GM never depends on the round trip.
   */
  public request(pause?: boolean): void {
    const desired = pause ?? !this.options.getPaused();

    if (this.options.isDesignatedGm()) {
      this.options.applyPause(desired);
      return;
    }

    if (this.options.socket === null) {
      this.options.logger?.warn('Cannot reach a GM to change the pause state: no socket.');
      return;
    }

    const request: PauseRequest = { action: 'togglePause', pause: desired };
    this.options.socket.emit(this.options.channel, request);
  }
}
