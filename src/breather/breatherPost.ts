import { automationRole } from '../automation/automationRole.js';
import type { RoleGlobals } from '../automation/automationRole.js';
import { imageUrl } from '../bands/bandTokens.js';
import type { BandGlobals } from '../bands/bandTokens.js';
import type { CooClient } from '../bands/CooClient.js';
import { campaignOfCharacter } from '../bands/startHpLog.js';
import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import type { FoundryGame } from '../foundry/PartyAccess.js';
import { BREATHER_FLAG } from './takeABreather.js';

/**
 * Telling the campaign's combat topic about each No-Limit Stamina breather. Added 2026-11-02. Lewis: "Could
 * the macro always post to that campaign's combat topic regardless of if they are in combat?"
 *
 * ⛔ ONE BROWSER POSTS: the active full GM's (`automationRole`), because only a GM's ComeOnOverUno sign-in may
 *    post, and the player who ran the macro has none. The player's chat card carries the facts in its flag, and
 *    every browser sees `createChatMessage`.
 * ⚠️ The campaign is the CHARACTER's, from the parties listing it (`campaignOfCharacter`, as the HP log reads
 *    it), never an encounter's: there may be no encounter. A world serving two campaigns (C00 and C01) posts to
 *    the one whose party lists the character; a character in none, or in two, posts nothing.
 * ⚠️ Silent when it cannot post: not signed in, no campaign, or a server older than `breather` (a 404). The
 *    card in Foundry's chat is the record; the topic is a courtesy. Each is logged.
 */
const BREATHER_POST_PATH = (code: string): string =>
  `/api/pathwars/campaigns/${encodeURIComponent(code)}/breather`;

export type PostGlobals = RoleGlobals &
  BandGlobals & {
    readonly game?: RoleGlobals['game'];
    readonly fromUuidSync?: (uuid: string) => unknown;
  };

interface BreatherFacts {
  readonly actorUuid: string;
  readonly name: string;
  readonly spBefore: number;
  readonly maxSp: number;
  readonly img: string | null;
}

/** The card's flag, or null for any message that is not one of ours or is malformed. */
export function readBreatherFlag(message: unknown): BreatherFacts | null {
  const flag = (message as { flags?: Record<string, Record<string, unknown> | undefined> } | null)
    ?.flags?.[MODULE_ID]?.[BREATHER_FLAG] as Partial<Record<string, unknown>> | undefined;
  const { actorUuid, name, spBefore, maxSp, img } = flag ?? {};
  if (
    typeof actorUuid !== 'string' ||
    typeof name !== 'string' ||
    typeof spBefore !== 'number' ||
    typeof maxSp !== 'number'
  ) {
    return null;
  }
  return { actorUuid, name, spBefore, maxSp, img: typeof img === 'string' ? img : null };
}

/** Posts one card's breather if this browser should; says what happened, for the log and the tests. */
export async function postBreather(
  message: unknown,
  globals: PostGlobals,
  client: Pick<CooClient, 'call'>
): Promise<string> {
  const facts = readBreatherFlag(message);
  if (facts === null || automationRole(globals) !== 'act') {
    return 'not ours';
  }
  const actor = globals.fromUuidSync?.(facts.actorUuid);
  const choice = campaignOfCharacter(actor, globals.game as FoundryGame | undefined);
  if (choice.kind !== 'one') {
    return `no campaign for ${facts.name}`;
  }
  const image = imageUrl(facts.img, globals);
  const response = await client.call('POST', BREATHER_POST_PATH(choice.code), {
    name: facts.name,
    spBefore: facts.spBefore,
    maxSp: facts.maxSp,
    ...(image === null ? {} : { characterImage: image }),
  });
  return response === 'signed-out' ? 'signed out' : `${choice.code} ${String(response.status)}`;
}

export function startBreatherPosts(
  hooks: { on(name: string, fn: (message: unknown) => unknown): unknown },
  globals: PostGlobals,
  client: Pick<CooClient, 'call'>
): void {
  hooks.on('createChatMessage', (message) => {
    postBreather(message, globals, client)
      .then((outcome) => {
        if (outcome !== 'not ours') {
          logger.info(`Breather to the combat topic: ${outcome}.`);
        }
      })
      .catch((error: unknown) => {
        logger.warn(
          `Breather post failed: ${error instanceof Error ? error.message : String(error)}`
        );
      });
  });
}
