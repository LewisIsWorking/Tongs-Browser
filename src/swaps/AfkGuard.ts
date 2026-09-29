/**
 * Signs an idle GM out of Foundry. Added 2026-09-26. Lewis: "Could we add a 2 hour afk GM auto kick timer?"
 *
 * ⛔ WHY. An unattended PC sitting in a world with Tongs running counts as "a GM is here", so every player who
 * needed that world restarted waited for an approval nobody could give: three players were stuck behind one
 * the weekend this was written. Signing out frees the world; COO also stops counting a GM idle for 30 minutes (2 hours until 2026-09-29)
 * (the heartbeat reports idle time), which covers a tab too frozen to sign itself out.
 *
 * ⚠️ WARN FIRST. Five minutes before the limit the GM is asked "Still there?"; "I'm here" resets the clock.
 *    A GM reading a long post without touching anything is exactly who must not be thrown out unannounced.
 */
export interface AfkPorts {
  readonly now: () => number;
  /** Asks the GM if they are still there. True means "I'm here". */
  readonly warn: () => Promise<boolean>;
  /** Signs this browser out of Foundry. */
  readonly signOut: () => void;
}

export type AfkState = 'off' | 'active' | 'warned' | 'signed-out';

export const WARN_BEFORE_MS = 5 * 60_000;

export class AfkGuard {
  private readonly ports: AfkPorts;
  private readonly limitMs: number;
  private last: number;
  private warned = false;
  private done = false;

  /** A limit of 0 (or less) turns the guard off. */
  public constructor(ports: AfkPorts, limitMinutes: number) {
    this.ports = ports;
    this.limitMs = Math.max(0, limitMinutes) * 60_000;
    this.last = ports.now();
  }

  /** The GM did something. */
  public touch(): void {
    this.last = this.ports.now();
    this.warned = false;
  }

  public idleSeconds(): number {
    return Math.max(0, (this.ports.now() - this.last) / 1000);
  }

  /** Call on a timer. Warns once near the limit, signs out once at it. */
  public async tick(): Promise<AfkState> {
    if (this.limitMs <= 0) {
      return 'off';
    }
    if (this.done) {
      return 'signed-out';
    }
    const idle = this.ports.now() - this.last;
    if (idle >= this.limitMs) {
      this.done = true;
      this.ports.signOut();
      return 'signed-out';
    }
    if (idle >= this.limitMs - WARN_BEFORE_MS && !this.warned) {
      this.warned = true;
      const here = await this.ports.warn().catch(() => undefined);
      if (here === undefined) {
        return 'warned'; // the prompt could not be shown: neither sign out early nor reset, let the limit decide
      }
      if (here) {
        this.touch();
        return 'active';
      }
      // "Sign me out now": they are leaving, so do not hold the world a minute longer.
      this.done = true;
      this.ports.signOut();
      return 'signed-out';
    }
    return this.warned ? 'warned' : 'active';
  }
}
