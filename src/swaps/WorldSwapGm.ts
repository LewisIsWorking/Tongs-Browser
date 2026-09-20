import type { CooResponse } from '../bands/CooClient.js';

/**
 * The GM's half of world swapping. Added 2026-09-20.
 *
 * ⛔ WITHOUT THIS, COO CANNOT ASK ANYONE. A player pressing Play for a world that is not running makes COO
 * check whether a GM is connected: if one is, the switch waits for their answer; if none is, it just
 * happens (Lewis, 2026-09-17). Nothing told COO a GM was there, so every swap took the second path. This is
 * the heartbeat that says "a GM is in this world", and the prompt that answers.
 *
 * ⚠️ THE HEARTBEAT IS THE ANSWER CHANNEL TOO. COO returns the requests waiting on this world with every
 * heartbeat, so there is one call on a timer rather than two. A window shorter than COO's presence window
 * (75s) is what keeps a GM counted as present between beats.
 *
 * ⛔ ONE PROMPT PER REQUEST, EVER. The same request comes back in every heartbeat until it is decided, and
 * a second dialog for a request already on screen would stack windows over the GM's table. Ids already
 * seen are remembered, including after the answer, because COO keeps reporting a decided request briefly.
 *
 * ⚠️ A FAILED DECISION IS FORGOTTEN, not retried silently: the GM sees the failure and the next heartbeat
 * offers it again, rather than the request quietly expiring while they think they answered.
 */
export interface SwapRequestView {
  readonly id: string;
  readonly requester: string;
  readonly from: string;
  readonly to: string;
  readonly state: string;
  readonly message?: string;
}

export interface WorldSwapPorts {
  /** True only for the GM whose browser should answer; see automationRole. */
  readonly isGm: () => boolean;
  /** The world this browser has open, or '' when none. */
  readonly worldId: () => string;
  /** One signed-in COO call, with the token handling CooClient already does. */
  readonly call: (
    method: 'GET' | 'POST',
    path: string,
    body?: object
  ) => Promise<CooResponse | 'signed-out'>;
  /** Asks the GM. True allows the switch. */
  readonly ask: (request: SwapRequestView) => Promise<boolean>;
  /** Tells the GM something they need to know, such as a decision that did not reach COO. */
  readonly notify: (message: string) => void;
}

export type BeatOutcome = 'not-gm' | 'no-world' | 'signed-out' | 'failed' | 'beat';

const AWAITING = 'AwaitingGm';

export class WorldSwapGm {
  private readonly ports: WorldSwapPorts;
  private readonly seen = new Set<string>();

  public constructor(ports: WorldSwapPorts) {
    this.ports = ports;
  }

  /** One heartbeat: tell COO a GM is here, then answer anything waiting. */
  public async beat(): Promise<BeatOutcome> {
    if (!this.ports.isGm()) {
      return 'not-gm';
    }
    const worldId = this.ports.worldId();
    if (worldId === '') {
      return 'no-world';
    }
    const response = await this.ports.call('POST', '/api/foundry/presence', { worldId });
    if (response === 'signed-out') {
      return 'signed-out';
    }
    if (response.status !== 200) {
      return 'failed';
    }
    for (const request of pendingOf(await response.json())) {
      await this.consider(request);
    }
    return 'beat';
  }

  private async consider(request: SwapRequestView): Promise<void> {
    if (request.state !== AWAITING || this.seen.has(request.id)) {
      return;
    }
    this.seen.add(request.id);
    const approve = await this.ports.ask(request);
    const response = await this.ports.call(
      'POST',
      `/api/foundry/swap/${encodeURIComponent(request.id)}/decision`,
      { approve }
    );
    if (response === 'signed-out' || response.status !== 200) {
      /* Forgotten on purpose: the next heartbeat asks again rather than losing the answer silently. */
      this.seen.delete(request.id);
      this.ports.notify(
        `Could not tell COO about ${request.requester}'s world swap. It will ask again.`
      );
    }
  }
}

/** The requests in COO's answer, ignoring anything shaped unexpectedly rather than throwing at a GM. */
export function pendingOf(body: unknown): SwapRequestView[] {
  const pending = (body as { pending?: unknown } | null)?.pending;
  if (!Array.isArray(pending)) {
    return [];
  }
  const views: SwapRequestView[] = [];
  for (const row of pending) {
    const { id, requester, from, to, state, message } = (row ?? {}) as Record<string, unknown>;
    if (typeof id !== 'string' || id === '' || typeof state !== 'string') {
      continue;
    }
    const view: SwapRequestView = {
      id,
      requester: typeof requester === 'string' && requester !== '' ? requester : 'A player',
      from: typeof from === 'string' ? from : '',
      to: typeof to === 'string' ? to : '',
      state,
    };
    views.push(typeof message === 'string' && message !== '' ? { ...view, message } : view);
  }
  return views;
}
