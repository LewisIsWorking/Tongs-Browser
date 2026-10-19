import { automationRole, GAMEMASTER_ROLE } from '../automation/automationRole.js';
import type { RoleGlobals } from '../automation/automationRole.js';
import type { ActivityEvent, ActivityLog } from './activityLog.js';
import type { CooClient } from './CooClient.js';
import { escapeHtml, registerGmMenu } from './settingsMenu.js';
import type { MenuGlobals, MenuSettings } from './settingsMenu.js';

/**
 * Showing what Tongs Browser has done: a GM-only "Tongs activity" menu in the module settings, and a status
 * heartbeat to ComeOnOverUno every few minutes, signed in or not. Added 2026-10-19 at Lewis's request.
 *
 * The heartbeat is how a missing combat post gets traced without joining the game: COO keeps the latest
 * report per world (`api/tongs/status`) for an admin or Claude to read. It goes through `CooClient.tell`, the
 * call that needs no session, because "not signed in" is exactly what it must be able to say.
 *
 * ⛔ ONLY A FULL GM'S BROWSER REPORTS, so players' browsers never send the log, and a world with no GM on
 * sends nothing at all: the report's age then says when a GM was last there.
 */
export const STATUS_PATH = '/api/tongs/status';
export const HEARTBEAT_MS = 5 * 60_000;
/** The first report, soon after the world loads, so a fresh sign-in problem shows within a minute. */
export const FIRST_REPORT_MS = 30_000;

export type StatusGlobals = RoleGlobals & {
  readonly game?: {
    readonly world?: { readonly id?: string };
    readonly user?: { readonly name?: string };
  };
};

export interface StatusPorts {
  readonly log: ActivityLog;
  readonly signedIn: () => boolean;
  readonly version: () => string;
  readonly every: (run: () => void, ms: number) => unknown;
  readonly later: (run: () => void, ms: number) => unknown;
}

/** What this browser reports, or null when it must not (no world, or not a full GM). */
export function statusReport(globals: StatusGlobals, ports: StatusPorts): object | null {
  const world = globals.game?.world?.id;
  if (world === undefined || world === '' || globals.game?.user?.role !== GAMEMASTER_ROLE) {
    return null;
  }
  return {
    world,
    version: ports.version(),
    signedIn: ports.signedIn(),
    role: automationRole(globals),
    user: globals.game.user.name ?? '',
    events: ports.log.entries(),
  };
}

/** Reports now and then every `HEARTBEAT_MS`. A failed report is dropped: the next one carries the same log. */
export function startStatusHeartbeat(
  client: CooClient,
  globals: StatusGlobals,
  ports: StatusPorts
): void {
  const send = () => {
    const report = statusReport(globals, ports);
    if (report !== null) {
      void client.tell(STATUS_PATH, report).catch(() => 0);
    }
  };
  ports.later(send, FIRST_REPORT_MS);
  ports.every(send, HEARTBEAT_MS);
}

export type ActivityMenuGlobals = MenuGlobals & {
  readonly foundry?: {
    readonly applications?: {
      readonly api?: { readonly DialogV2?: { input?(options: object): Promise<unknown> } };
    };
  };
};

/** The menu's contents: the sign-in state, then the events, newest first. */
export function activityHtml(signedIn: boolean, events: readonly ActivityEvent[]): string {
  const state = signedIn
    ? '<p><b>Signed in</b> to ComeOnOverUno.</p>'
    : '<p><b>Not signed in</b> to ComeOnOverUno: nothing reaches Telegram until you sign in.</p>';
  if (events.length === 0) {
    return `${state}<p>Nothing has happened yet in this browser since the world loaded.</p>`;
  }
  const rows = [...events]
    .reverse()
    .map(
      (e) =>
        `<li><code>${escapeHtml(e.at.slice(11, 19))}</code> ${escapeHtml(e.kind)}: ${escapeHtml(e.text)}</li>`
    )
    .join('');
  return `${state}<ul style="max-height:24em;overflow-y:auto">${rows}</ul>`;
}

/** True when the menu was registered. False, never a throw, when Foundry refuses or cannot. */
export function registerActivityMenu(
  settings: MenuSettings,
  globals: ActivityMenuGlobals,
  log: ActivityLog,
  signedIn: () => boolean
): boolean {
  return registerGmMenu(
    settings,
    globals,
    {
      key: 'tongsActivity',
      name: 'Tongs activity',
      label: 'Show activity',
      hint: 'What Tongs Browser has sent to ComeOnOverUno from this browser, and any problems, newest first.',
      icon: 'fas fa-list',
    },
    async () =>
      globals.foundry?.applications?.api?.DialogV2?.input?.({
        window: { title: 'Tongs activity' },
        content: activityHtml(signedIn(), log.entries()),
        ok: { label: 'Close' },
      })
  );
}
