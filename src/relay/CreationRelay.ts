import type { GmPresence } from '../foundry/DesignatedGm.js';
import { authoriseCreation, type RequestWorld } from './CreationPolicy.js';
import { isCreationRequest, type CreationRequest } from './CreationRequest.js';
import { isCreationResult, type CreationResult } from './CreationResult.js';
import type { SocketLike } from './PauseRelay.js';
import { PendingRequests, type TimerPorts } from './PendingRequests.js';

/**
 * A player asks a GM to make them a character sheet, and hears back. Added 2026-09-03.
 *
 * ⚠️ Unlike `PauseRelay` this needs an ANSWER, and that is the whole difference. A pause is visible
 * the instant it happens, so fire and forget is honest there. A sheet created on somebody else's
 * client is invisible: nothing moves, and the requester cannot tell "it worked" from "nobody was
 * listening" from "you were refused". Every one of those has to come back as itself.
 *
 * ⚠️ EVERY client receives EVERY message on the channel. That single fact shapes the rest:
 * - a request is acted on only by the designated GM, or three GMs make three sheets;
 * - a result is matched on `requestId`, or a player resolves on somebody else's answer;
 * - a GM ignores results, including the ones it sent itself.
 *
 * ⚠️ A TIMEOUT is not optional. A request whose GM disconnects mid-flight is answered by nobody, and
 * without a timer the requester waits forever behind a spinner that never resolves. "I did not hear
 * back" is a real outcome and is reported as one.
 */
export type CreationOutcome =
  | { readonly kind: 'created'; readonly actorUuid: string | null }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'noGm' }
  | { readonly kind: 'noSocket' }
  | { readonly kind: 'timedOut' };

/** What can come back once a GM actually has the request. The other three never reached one. */
type PerformOutcome = Extract<CreationOutcome, { kind: 'created' } | { kind: 'refused' }>;

export interface CreationRelayOptions {
  readonly socket: SocketLike | null;
  readonly channel: string;
  /** Read live: a GM can connect or drop between one tap and the next. */
  readonly readPresence: () => GmPresence;
  /** Who is asking, from this client's own `game.user`, never from a payload. */
  readonly myUserId: () => string;
  /** The GM's own view of the world, read on the GM's client when a request arrives. */
  readonly readWorld: () => RequestWorld;
  /** Performs the create. Only ever called on the designated GM's client, after authorisation. */
  readonly create: (
    ownerId: string,
    partyUuid: string,
    name: string
  ) => Promise<{ readonly ok: boolean; readonly actorUuid?: string; readonly reason?: string }>;
  /** Injected so tests do not wait in real time, and so the id is not a hidden global dependency. */
  readonly newRequestId: () => string;
  readonly timers: TimerPorts;
}

export class CreationRelay {
  private bound = false;
  private readonly pending: PendingRequests<CreationOutcome>;

  private readonly onSocket = (payload: unknown): void => {
    if (isCreationRequest(payload)) {
      void this.serve(payload);
      return;
    }
    if (isCreationResult(payload)) {
      this.settle(payload);
    }
  };

  public constructor(private readonly options: CreationRelayOptions) {
    this.pending = new PendingRequests<CreationOutcome>(options.timers, () => ({
      kind: 'timedOut',
    }));
  }

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
   * Ask for a sheet.
   *
   * ⚠️ The designated GM does it DIRECTLY rather than emitting to itself, for the same reason
   * `PauseRelay` does: it must still work with no socket at all, and a solo GM should never depend on
   * a round trip that has nowhere to go.
   */
  public async request(partyUuid: string, name: string): Promise<CreationOutcome> {
    const presence = this.options.readPresence();

    if (presence.isMe) {
      return this.perform({
        action: 'createSheet',
        requestId: this.options.newRequestId(),
        userId: this.options.myUserId(),
        partyUuid,
        name,
      });
    }

    /* ⚠️ Checked BEFORE the socket, so "nobody can do this for you" beats "no way to ask". */
    if (!presence.online) {
      return { kind: 'noGm' };
    }
    if (this.options.socket === null) {
      return { kind: 'noSocket' };
    }

    return this.ask(partyUuid, name);
  }

  private async ask(partyUuid: string, name: string): Promise<CreationOutcome> {
    const requestId = this.options.newRequestId();
    const request: CreationRequest = {
      action: 'createSheet',
      requestId,
      userId: this.options.myUserId(),
      partyUuid,
      name,
    };

    /* ⚠️ Waiting is set up BEFORE the emit, so an answer on the same tick is not missed. */
    const answer = this.pending.wait(requestId);
    this.options.socket?.emit(this.options.channel, request);
    return answer;
  }

  /** The GM side. Authorise from the GM's own view, act, and say what happened. */
  private async serve(request: CreationRequest): Promise<void> {
    if (!this.options.readPresence().isMe) {
      return;
    }

    const outcome = await this.perform(request);
    const result: CreationResult =
      outcome.kind === 'created'
        ? { action: 'createSheetResult', requestId: request.requestId, ok: true, ...uuid(outcome) }
        : {
            action: 'createSheetResult',
            requestId: request.requestId,
            ok: false,
            reason: outcome.reason,
          };
    this.options.socket?.emit(this.options.channel, result);
  }

  /**
   * Authorise and create. Shared by the GM serving a request and a GM asking for themselves.
   *
   * ⚠️ Returns the NARROWED union, not `CreationOutcome`. The wider type forced a `reason` fallback
   * for `noGm`, `noSocket` and `timedOut`, none of which this can produce: those describe a request
   * that never reached a GM, and this only runs once one has it. That fallback was a branch nothing
   * could reach and no honest test could cover. Saying so in the type deletes it, and makes a future
   * outcome that genuinely can occur here a compile error rather than a silent default.
   */
  private async perform(request: CreationRequest): Promise<PerformOutcome> {
    const verdict = authoriseCreation(request, this.options.readWorld());
    if (verdict.kind === 'refused') {
      return { kind: 'refused', reason: verdict.reason };
    }

    const made = await this.options.create(verdict.ownerId, verdict.partyUuid, verdict.name);
    if (!made.ok) {
      return { kind: 'refused', reason: made.reason ?? 'The sheet could not be created.' };
    }
    return { kind: 'created', actorUuid: made.actorUuid ?? null };
  }

  /** ⚠️ Matched on the id THIS client sent. Everyone receives every result. */
  private settle(result: CreationResult): void {
    this.pending.settle(
      result.requestId,
      result.ok
        ? { kind: 'created', actorUuid: result.actorUuid ?? null }
        : { kind: 'refused', reason: result.reason ?? 'The GM did not say why.' }
    );
  }
}

/** ⚠️ Omits the key entirely when there is no uuid, so `exactOptionalPropertyTypes` stays satisfied. */
function uuid(outcome: { readonly actorUuid: string | null }): { actorUuid?: string } {
  return outcome.actorUuid === null ? {} : { actorUuid: outcome.actorUuid };
}
