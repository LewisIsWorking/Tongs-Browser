import { MODULE_ID } from '../constants.js';
import type { CooClient } from '../bands/CooClient.js';
import { escapeHtml, registerGmMenu } from '../bands/settingsMenu.js';
import type { MenuGlobals, MenuSettings } from '../bands/settingsMenu.js';
import type { PlayerLinks } from './encounterSnapshot.js';

/**
 * Which Telegram player each Foundry player user is, for the encounter tracker's names and the bot's pings.
 * Added 2026-09-16.
 *
 * ⛔ DECIDED WITH LEWIS: the link is PER FOUNDRY USER, set once, and every character that user owns follows it.
 * The choices come from ComeOnOverUno's Path Wars roster (the bot's own player list), so a typo can never
 * produce a Telegram id that pings nobody, or the wrong person.
 *
 * ⚠️ A WORLD setting, hidden from the settings form: the GM edits it through this menu, and every GM browser
 * that posts an encounter needs the same answer.
 */
const PLAYER_LINKS_SETTING = 'playerLinks';

export interface LinkSettings extends MenuSettings {
  register(namespace: string, key: string, data: FoundrySettingRegistration): void;
  get(namespace: string, key: string): unknown;
  set(namespace: string, key: string, value: unknown): Promise<unknown>;
}

export interface LinkGlobals extends MenuGlobals {
  readonly foundry?: MenuGlobals['foundry'] & {
    readonly applications?: {
      readonly api?: { readonly DialogV2?: { input?(options: object): Promise<unknown> } };
    };
  };
  readonly ui?: {
    readonly notifications?: { info?(message: string): unknown; warn?(message: string): unknown };
  };
}

export interface PlayerUser {
  readonly id: string;
  readonly name: string;
}

interface RosterPlayer {
  readonly telegramUserId: string;
  readonly displayName: string;
}

export function registerPlayerLinksSetting(settings: LinkSettings): void {
  settings.register(MODULE_ID, PLAYER_LINKS_SETTING, {
    name: 'Telegram players',
    scope: 'world',
    config: false,
    type: Object,
    default: {},
  });
}

/** The saved links, keeping only well-formed entries: a Foundry user id to a Telegram user id of digits. */
export function readPlayerLinks(settings: Pick<LinkSettings, 'get'>): PlayerLinks {
  const raw = settings.get(MODULE_ID, PLAYER_LINKS_SETTING);
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(raw).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && /^\d{1,30}$/.test(entry[1])
    )
  );
}

async function roster(client: CooClient): Promise<RosterPlayer[] | null> {
  const response = await client.call('GET', '/api/pathwars/players');
  if (response === 'signed-out' || response.status !== 200) {
    return null;
  }
  const body = await response.json();
  return Array.isArray(body)
    ? body.filter(
        (each): each is RosterPlayer =>
          typeof (each as RosterPlayer).telegramUserId === 'string' &&
          typeof (each as RosterPlayer).displayName === 'string'
      )
    : null;
}

/** Opens the menu and saves the links. Resolves to how many players are linked afterwards, or null on no change. */
export async function editPlayerLinks(
  settings: LinkSettings,
  globals: LinkGlobals,
  client: CooClient,
  users: () => readonly PlayerUser[]
): Promise<number | null> {
  const notify = globals.ui?.notifications;
  const players = await roster(client);
  if (players === null) {
    notify?.warn?.(
      'Tongs Browser could not load the Path Wars players. Sign in to ComeOnOverUno first.'
    );
    return null;
  }
  const saved = readPlayerLinks(settings);
  const options = (userId: string) =>
    ['<option value="">Not linked</option>']
      .concat(
        players.map(
          (p) =>
            `<option value="${escapeHtml(p.telegramUserId)}"${saved[userId] === p.telegramUserId ? ' selected' : ''}>${escapeHtml(p.displayName)}</option>`
        )
      )
      .join('');
  const content = users()
    .map(
      (u) =>
        `<label>${escapeHtml(u.name)} <select name="${escapeHtml(u.id)}">${options(u.id)}</select></label>`
    )
    .join('');
  const answer = (await globals.foundry?.applications?.api?.DialogV2?.input?.({
    window: { title: 'Telegram player for each Foundry player' },
    content: `<div class="tb-party-campaigns">${content}</div>`,
    ok: { label: 'Save' },
  })) as Record<string, unknown> | null | undefined;
  if (answer === null || answer === undefined) {
    return null;
  }
  const known = new Set(players.map((p) => p.telegramUserId));
  const links = Object.fromEntries(
    users().flatMap((u) => {
      const chosen = answer[u.id];
      return typeof chosen === 'string' && known.has(chosen) ? [[u.id, chosen]] : [];
    })
  );
  await settings.set(MODULE_ID, PLAYER_LINKS_SETTING, links);
  const count = Object.keys(links).length;
  notify?.info?.(`Linked ${String(count)} ${count === 1 ? 'player' : 'players'} to Telegram.`);
  return count;
}

export function registerPlayerLinksMenu(
  settings: LinkSettings,
  globals: LinkGlobals,
  client: CooClient,
  users: () => readonly PlayerUser[]
): boolean {
  return registerGmMenu(
    settings,
    globals,
    {
      key: 'playerLinksMenu',
      name: 'Telegram players',
      label: 'Link players',
      hint: 'Which Path Wars Telegram player each Foundry player is, so the combat topic can name them and the bot can ping them.',
      icon: 'fab fa-telegram',
    },
    async () => editPlayerLinks(settings, globals, client, users)
  );
}
