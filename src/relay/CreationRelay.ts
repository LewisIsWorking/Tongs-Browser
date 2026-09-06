import type { GmPresence } from '../foundry/DesignatedGm.js';
import type { CreationOutcome, PerformOutcome } from './CreationOutcome.js';
import { authoriseCreation, type RequestWorld } from './CreationPolicy.js';
import { isCreationRequest, type CreationRequest } from './CreationRequest.js';
import { isCreationResult, resultFor, type CreationResult } from './CreationResult.js';
import type { SocketLike } from './PauseRelay.js';
import { PendingRequests, type TimerPorts } from './PendingRequests.js';
import { proves, UNPROVEN_REASON, type ProofPorts } from './RequestProof.js';
import { SocketBinding } from './SocketBinding.js';

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
  /**
   * Proves the sender is who the payload says. See `RequestProof`.
   *
   * ⛔ REQUIRED, not optional. An optional security check is one somebody forgets to wire, and it
   * fails open when they do: the relay would go on trusting a claimed id with nothing saying so.
   */
  readonly proof: ProofPorts;
}

export class CreationRelay {
  private readonly binding: SocketBinding;
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
    /* ⚠️ A thunk, not `options.socket`: it is a getter over a global that is null until `ready`. */
    this.binding = new SocketBinding(() => options.socket, options.channel, this.onSocket);
  }

  public bind(): void {
    this.binding.bind();
  }

  public unbind(): void {
    this.binding.unbind();
  }

  public isBound(): boolean {
    return this.binding.isBound();
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

    /*
     * ⚠️ Waiting starts BEFORE the emit so a same-tick answer is not missed, and before the CLAIM so
     * the timeout covers the flag write too. Claiming first left a server that never answered the
     * write hanging the caller with no timer running: the exact outcome the timeout exists for,
     * reachable only through the code added to make the ask trustworthy. Caught by the timer
     * fixtures, 2026-09-06.
     *
     * ⛔ The claim is then AWAITED BEFORE THE EMIT, and that await is load bearing. It resolves only
     * once the server has accepted the write, so the proof exists before anyone can act on the ask.
     * Emitting first would race our own proof and refuse our own honest request.
     */
    const answer = this.pending.wait(requestId);
    await this.options.proof.claim(requestId);
    this.options.socket?.emit(this.options.channel, request);
    return answer;
  }

  /**
   * The GM side. Prove who asked, authorise from the GM's own view, act, and say what happened.
   *
   * ⛔ THE PROOF COMES FIRST, before the policy, and the order is the point. `authoriseCreation`
   * decides what the named user is entitled to; it has always been right about that and has no way
   * to know whether the payload really came from them. Asking "is this user allowed" before "is this
   * actually this user" answers a question about the wrong person.
   */
  private async serve(request: CreationRequest): Promise<void> {
    if (!this.options.readPresence().isMe) {
      return;
    }

    const outcome = proves(this.options.proof.readClaim(request.userId), request.requestId)
      ? await this.perform(request)
      : ({ kind: 'refused', reason: UNPROVEN_REASON } as const);

    /* ⚠️ Released whatever happened. A refusal that left the claim standing would let the same
     * payload be retried forever, and a failed create is exactly when a client retries. */
    await this.options.proof.release(request.userId);
    this.options.socket?.emit(this.options.channel, resultFor(request.requestId, outcome));
  }

  /**
   * Authorise and create. Shared by the GM serving a request and a GM asking for themselves.
   *
   * ⚠️ Returns `PerformOutcome`, the NARROWED union, and `CreationOutcome.ts` says why.
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
