import {
  MAINTENANCE_PATH,
  PROGRESS_PAGE,
  bannerText,
  readMaintenance,
  verdict,
} from './maintenanceNotice.js';
import type { Maintenance } from './maintenanceNotice.js';

/**
 * Watching COO's nightly update from inside a world: the countdown banner, then the move to the progress
 * page. Added 2026-10-11 (see maintenanceNotice.ts for why).
 *
 * ⭐ ON FOR EVERYONE, NO SETTING. It only ever shows something while COO is about to close this very world,
 *    and being dropped on Foundry's bare "connection lost" screen is the thing it exists to prevent.
 * ⚠️ Same-origin and anonymous: COO's Caddy answers /coo-api/foundry/maintenance on Foundry's own host, so
 *    it needs neither the COO sign-in nor CORS. On a world COO does not host the call gets Foundry's 404,
 *    which reads as "nothing to say", and Tongs stays silent.
 * ⚠️ Asks once a minute, and every five seconds during a countdown, so the move happens within seconds of
 *    the world closing. A lost connection while warned moves at once: that IS the world closing.
 */
export const IDLE_POLL_MS = 60_000;
export const WARNING_POLL_MS = 5_000;

export interface MaintenancePorts {
  readonly ask: () => Promise<unknown>;
  readonly worldId: () => string | undefined;
  readonly now: () => number;
  readonly show: (text: string) => void;
  readonly hide: () => void;
  readonly leave: (url: string) => void;
}

export class MaintenanceWatch {
  private state: Maintenance | null = null;
  private asked = -Infinity;
  private asking = false;
  private gone = false;

  public constructor(private readonly ports: MaintenancePorts) {}

  /** Called every second: asks COO when due, then shows, hides or leaves. */
  public async tick(): Promise<void> {
    const due = this.state?.phase === 'warning' ? WARNING_POLL_MS : IDLE_POLL_MS;
    if (!this.asking && this.ports.now() - this.asked >= due) {
      this.asking = true;
      this.asked = this.ports.now();
      try {
        this.state = readMaintenance(await this.ports.ask(), this.ports.now());
      } catch {
        /* COO not answering is not news; keep what was last known. */
      } finally {
        this.asking = false;
      }
    }
    this.apply();
  }

  /** Foundry lost its connection. During a countdown that is the world closing, so go now. */
  public disconnected(): void {
    if (this.state?.phase === 'warning' || this.state?.phase === 'running') {
      this.go();
    }
  }

  private apply(): void {
    const next = verdict(this.state, this.ports.worldId(), this.ports.now());
    if (next.kind === 'leave') {
      this.go();
    } else if (next.kind === 'banner') {
      this.ports.show(bannerText(next.secondsLeft));
    } else {
      this.ports.hide();
    }
  }

  private go(): void {
    if (!this.gone) {
      this.gone = true;
      this.ports.leave(PROGRESS_PAGE);
    }
  }
}

const BANNER_ID = 'tongs-maintenance-banner';

/** The banner: one element, made on first use, fixed above everything Foundry draws. */
export function bannerPorts(document: Document): Pick<MaintenancePorts, 'show' | 'hide'> {
  const find = (): HTMLElement | null => document.getElementById(BANNER_ID);
  return {
    show: (text) => {
      let banner = find();
      if (banner === null) {
        banner = document.createElement('div');
        banner.id = BANNER_ID;
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        banner.style.cssText =
          'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:100000;max-width:min(36rem,calc(100vw - 32px));' +
          'padding:10px 14px;border-radius:8px;background:#26262c;color:#eee;border:2px solid #c9a227;' +
          'font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.5);text-align:center;';
        document.body.append(banner);
      }
      banner.textContent = text;
    },
    hide: () => find()?.remove(),
  };
}

interface MaintenanceGlobals {
  readonly game?: {
    readonly world?: { readonly id?: string };
    readonly socket?: { on?: (event: string, run: () => void) => unknown } | null;
  };
  readonly location?: { assign(url: string): void };
  readonly fetch?: (
    path: string,
    init?: object
  ) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
}

/**
 * Wires the watch to Foundry, the page and a once-a-second timer.
 * ⚠️ A tick that throws is swallowed: a banner that cannot draw must never surface as an error in Foundry.
 */
export function startMaintenance(
  globals: MaintenanceGlobals,
  document: Document,
  every: (run: () => void, ms: number) => unknown = (run, ms) => setInterval(run, ms)
): MaintenanceWatch {
  const watch = new MaintenanceWatch({
    ask: async () => {
      const res = await globals.fetch?.(MAINTENANCE_PATH, {
        cache: 'no-store',
        credentials: 'omit',
      });
      return res?.ok === true ? res.json() : null;
    },
    worldId: () => globals.game?.world?.id,
    now: () => Date.now(),
    leave: (url) => globals.location?.assign(url),
    ...bannerPorts(document),
  });
  globals.game?.socket?.on?.('disconnect', () => {
    watch.disconnected();
  });
  every(() => void watch.tick().catch(() => undefined), 1000);
  void watch.tick().catch(() => undefined);
  return watch;
}
