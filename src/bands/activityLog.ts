/**
 * What Tongs Browser has done with ComeOnOverUno in this browser, newest last. Added 2026-10-19.
 *
 * Lewis: "would it not be better to be able to read what TONGS has and hasn't done?" A missing combat post
 * left no trace anywhere: a signed-out Tongs reaches nothing, and a warning toast is gone once dismissed.
 * So every request to COO (its path and answer), every warning and every sign-in change is kept here, shown
 * in the GM's Tongs activity menu and sent with the status heartbeat (`tongsStatus.ts`).
 *
 * ⛔ PATHS ONLY, never bodies or headers: the refresh token travels in a body and the access token in a
 * header, and neither may ever reach this log.
 */
export type ActivityKind = 'request' | 'warning' | 'session';

export interface ActivityEvent {
  readonly at: string;
  readonly kind: ActivityKind;
  readonly text: string;
}

export const MAX_EVENTS = 40;

export class ActivityLog {
  private readonly events: ActivityEvent[] = [];
  private readonly now: () => number;

  public constructor(now: () => number) {
    this.now = now;
  }

  public record(kind: ActivityKind, text: string): void {
    this.events.push({ at: new Date(this.now()).toISOString(), kind, text });
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }
  }

  public entries(): readonly ActivityEvent[] {
    return [...this.events];
  }
}

/** The one log for this browser, shared by the client, the warnings and the menu. */
export const activity = new ActivityLog(() => Date.now());

/** "POST /api/pathwars/campaigns/C06/combat-band 200": the path without its server or query string. */
export function requestText(
  url: string,
  method: string | undefined,
  answer: number | string
): string {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url.split('?')[0] ?? url;
  }
  return `${method ?? 'GET'} ${path} ${String(answer)}`;
}
