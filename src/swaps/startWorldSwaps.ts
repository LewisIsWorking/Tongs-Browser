import { automationRole } from '../automation/automationRole.js';
import type { RoleGlobals } from '../automation/automationRole.js';
import type { CooClient } from '../bands/CooClient.js';
import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { WorldSwapGm } from './WorldSwapGm.js';
import type { SwapRequestView } from './WorldSwapGm.js';

/**
 * Connecting the GM's half of world swapping to Foundry. Added 2026-09-20.
 *
 * ⚠️ ON BY DEFAULT, unlike every other automation here, and deliberately. The other settings guard an
 * action Tongs takes on its own; this one guards nothing: it only makes COO ASK before it pulls the
 * world out from under a live table. Off is the dangerous setting, because COO's rule is "no GM
 * connected, the swap just happens" (Lewis, 2026-09-17). Nothing is sent until the GM signs this
 * browser in to COO, which is already a deliberate act.
 *
 * ⚠️ BEATS EVERY 30s AGAINST COO'S 75s WINDOW, so two beats may be lost before a GM stops counting as
 * present. A request waits 2 minutes (`SwapRequestLifetime`), which is four beats to notice and answer.
 *
 * ⛔ ONLY THE ACTIVE FULL GM'S BROWSER BEATS. `automationRole` names exactly one browser, so an
 * Assistant GM and a second GM tab neither beat nor prompt. Otherwise one request would open a dialog
 * on every GM screen and the first answer would win a race with the others.
 */
const APPROVE_SETTING = 'approveWorldSwaps';
const BEAT_MS = 30_000;

interface SwapSettings {
  register(module: string, key: string, definition: object): void;
  get(module: string, key: string): unknown;
}

export type SwapGlobals = RoleGlobals & {
  readonly game?: { readonly world?: { readonly id?: unknown } };
  readonly foundry?: {
    readonly applications?: {
      readonly api?: { readonly DialogV2?: { confirm?(options: object): Promise<unknown> } };
    };
  };
  readonly ui?: { readonly notifications?: { warn?(message: string): unknown } };
};

export interface SwapTimers {
  readonly every: (run: () => void, ms: number) => unknown;
  readonly stop: (handle: unknown) => void;
}

export function registerWorldSwaps(settings: SwapSettings): void {
  settings.register(MODULE_ID, APPROVE_SETTING, {
    name: 'Answer world-swap requests',
    hint:
      'Tells ComeOnOverUno a GM is in this world, and asks you before another campaign takes the server. ' +
      'With this off, a player pressing Play for a different world closes yours without asking. Needs the ' +
      'ComeOnOverUno sign-in.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** What the GM reads at the table: who, which world, and that saying no keeps theirs open. */
export function swapPrompt(request: SwapRequestView): string {
  const to = request.to === '' ? 'another world' : request.to;
  const because = request.message === undefined ? '' : `<p>${escape(request.message)}</p>`;
  return (
    `<p><strong>${escape(request.requester)}</strong> wants to play in ` +
    `<strong>${escape(to)}</strong>.</p>${because}` +
    '<p>Allowing it closes this world and launches theirs. Anyone here is disconnected.</p>'
  );
}

function buildGm(settings: SwapSettings, globals: SwapGlobals, client: CooClient): WorldSwapGm {
  return new WorldSwapGm({
    isGm: () =>
      settings.get(MODULE_ID, APPROVE_SETTING) !== false && automationRole(globals) === 'act',
    worldId: () => {
      const id = globals.game?.world?.id;
      return typeof id === 'string' ? id : '';
    },
    call: (method, path, body) => client.call(method, path, body),
    ask: async (request) => {
      /* A closed dialog is a NO: the GM's world stays open, which is the answer that loses nothing. */
      const answer = await globals.foundry?.applications?.api?.DialogV2?.confirm?.({
        window: { title: 'ComeOnOverUno: world swap' },
        content: swapPrompt(request),
        yes: { label: 'Close this world' },
        no: { label: 'Keep playing' },
        rejectClose: false,
      }).catch(() => false);
      return answer === true;
    },
    notify: (message) => {
      globals.ui?.notifications?.warn?.(message);
    },
  });
}

/** Starts the heartbeat. Returns the stop, which nothing calls today but a test and a reload do. */
export function startWorldSwaps(
  settings: SwapSettings,
  globals: SwapGlobals,
  client: CooClient,
  timers: SwapTimers = {
    every: (run, ms) => setInterval(run, ms),
    stop: (handle) => {
      clearInterval(handle as ReturnType<typeof setInterval>);
    },
  }
): () => void {
  const gm = buildGm(settings, globals, client);
  const handle = timers.every(() => {
    gm.beat().catch((error: unknown) => {
      logger.warn(
        `World-swap heartbeat failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  }, BEAT_MS);
  return () => {
    timers.stop(handle);
  };
}
