/**
 * Requests that have been sent and not yet answered. Extracted 2026-09-03 when `CreationRelay`
 * crossed the 200 line limit.
 *
 * ⚠️ Worth being its own thing rather than a Map inside the relay, because it is where the two
 * subtle failures live and both are silent:
 *
 * - an answer must be matched to the request THIS client sent. Every client receives every message
 *   on the channel, so an unmatched settle resolves a player's wait on somebody else's answer.
 * - a request that is never answered must still end. A GM disconnecting mid-flight leaves the
 *   requester behind a spinner that resolves never, which reads as the module hanging.
 */
export interface TimerPorts {
  /** Injected so tests do not wait in real time and the timer is not a hidden global. */
  readonly setTimer: (run: () => void, ms: number) => unknown;
  readonly clearTimer: (handle: unknown) => void;
  readonly timeoutMs: number;
}

export class PendingRequests<T> {
  private readonly waiting = new Map<
    string,
    { readonly settle: (value: T) => void; readonly timer: unknown }
  >();

  public constructor(
    private readonly timers: TimerPorts,
    /** What a request becomes when nobody answers it. */
    private readonly onTimeout: () => T
  ) {}

  /**
   * Start waiting for `id`.
   *
   * ⚠️ Registration happens SYNCHRONOUSLY, inside the promise executor, so the entry exists before
   * this returns and therefore before the caller emits. Registering after the emit would lose an
   * answer that arrived on the same tick, which is exactly what happens when the designated GM is
   * the local client's own socket loopback.
   */
  public wait(id: string): Promise<T> {
    return new Promise<T>((resolve) => {
      const timer = this.timers.setTimer(() => {
        this.waiting.delete(id);
        resolve(this.onTimeout());
      }, this.timers.timeoutMs);

      this.waiting.set(id, { settle: resolve, timer });
    });
  }

  /** Answer a request. Unknown ids are IGNORED: they belong to another client at the same table. */
  public settle(id: string, value: T): void {
    const pending = this.waiting.get(id);
    if (pending === undefined) {
      return;
    }
    this.waiting.delete(id);
    this.timers.clearTimer(pending.timer);
    pending.settle(value);
  }

  /** How many are outstanding. Lets a test assert that a settled request stopped being tracked. */
  public size(): number {
    return this.waiting.size;
  }
}
