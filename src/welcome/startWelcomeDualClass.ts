import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import {
  DUAL_REQUEST_FLAG,
  DUAL_RESULT_FLAG,
  readDualClassRequest,
  readDualClassResult,
} from '../dualclass/dualClassRequest.js';
import { dualClassOf } from '../dualclass/landDualClass.js';
import type { GuideSheet } from './guideView.js';
import { IMPORT_DONE_FLAG, IMPORT_FLAG } from './importBuild.js';
import { MADE_FOR_FLAG } from './sheetRequest.js';
import type { WelcomeGlobals, WelcomeHooks } from './startSheetRequests.js';
import { WANTED_FLAG, readWantedDualClass } from './welcomeDualClass.js';
import { ownCharacters } from './welcomeDocuments.js';

/**
 * The welcome's two classes, sent as a Dual class request once the new sheet exists. Added 2026-10-20.
 *
 * ⭐ The seam: this writes exactly the request the tray's Dual class window writes (`dualClassRequest`, on
 *    the player's own user, naming the sheet and both classes), and nothing else. So the GM's browser (or
 *    COO's helper GM) checks it as strictly as ever (the sheet is theirs, both classes come from a listed
 *    compendium, two different classes), and `startDualClassPlayer` lands the answer from the PLAYER's
 *    browser, where PF2e asks the class features' choices. There is no second builder.
 *
 * It waits, doing nothing, while: the sheet is not made yet; an import is still filling it (the import's
 * own class would replace the dual class); or a dual class request or answer is already on the user. A
 * sheet that already has a dual class just has the wish cleared, so a reload never asks twice.
 */
export function startWelcomeDualClass(
  hooks: WelcomeHooks,
  globals: WelcomeGlobals & { readonly crypto?: { randomUUID?(): string } },
  summon: () => void
): void {
  if (globals.game?.user?.isGM === true) {
    return;
  }
  let busy = false;

  async function run(): Promise<void> {
    const me = globals.game?.user;
    const wanted = readWantedDualClass(me?.getFlag?.(MODULE_ID, WANTED_FLAG));
    if (busy || me === undefined || wanted === null) {
      return;
    }
    const sheet: GuideSheet | undefined = ownCharacters(globals.game).find(
      (actor) => actor.getFlag?.(MODULE_ID, MADE_FOR_FLAG) === wanted.forRequest
    );
    if (typeof sheet?.id !== 'string') {
      return;
    }
    const importing =
      sheet.getFlag?.(MODULE_ID, IMPORT_FLAG) !== undefined &&
      sheet.getFlag(MODULE_ID, IMPORT_DONE_FLAG) !== true;
    const asked =
      readDualClassRequest(me.getFlag?.(MODULE_ID, DUAL_REQUEST_FLAG)) !== null ||
      readDualClassResult(me.getFlag?.(MODULE_ID, DUAL_RESULT_FLAG)) !== null;
    if (importing || asked) {
      return;
    }
    busy = true;
    try {
      if (dualClassOf(sheet.items?.contents) === undefined) {
        const id =
          globals.crypto?.randomUUID?.() ?? `${String(Date.now())}-${String(Math.random())}`;
        const { first, second } = wanted;
        await me.setFlag?.(MODULE_ID, DUAL_REQUEST_FLAG, {
          id,
          actorId: sheet.id,
          first,
          second,
          at: Date.now(),
        });
        /* No GM here: COO's helper GM serves it (`HelperCall` sends nothing while a GM is online). */
        summon();
      }
      await me.unsetFlag?.(MODULE_ID, WANTED_FLAG);
    } catch (error: unknown) {
      logger.warn(
        `Welcome dual class not sent: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      busy = false;
    }
  }

  for (const name of ['updateUser', 'createActor', 'updateActor', 'createItem']) {
    hooks.on(name, () => void run());
  }
  void run();
}
