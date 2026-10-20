import { MODULE_ID } from '../constants.js';
import { readGmPresence } from '../foundry/DesignatedGm.js';
import { offeredParties } from './campaignParty.js';
import { guideSteps } from './buildGuide.js';
import { guideView } from './guideView.js';
import { classChoices } from '../dualclass/classChoices.js';
import type { ChoiceGame } from '../dualclass/classChoices.js';
import { DUAL_CLASS_EVENT } from '../dualclass/startDualClassPlayer.js';
import { variantRules } from './variantRules.js';
import { ClassOffer } from './welcomeDualClass.js';
import { startWelcomeDualClass } from './startWelcomeDualClass.js';
import { GuidePanel } from './GuidePanel.js';
import { campaignsOf } from './playerCampaigns.js';
import { allowedSheets } from './extraSheets.js';
import { MADE_FOR_FLAG, REQUEST_FLAG, RESULT_FLAG, readSheetRequest } from './sheetRequest.js';
import { askForSheet, readSheetResult } from './sheetRequest.js';
import { sharedParties, WELCOME_SETTING } from './startSheetRequests.js';
import type { WelcomeGlobals, WelcomeHooks, WelcomeSettings } from './startSheetRequests.js';
import { HelperWake } from './helperWake.js';
import { WelcomeWindow } from './WelcomeWindow.js';
import type { WelcomeFace } from './WelcomeWindow.js';
import { countedCharacters, ownCharacters } from './welcomeDocuments.js';
import type { WelcomeActor } from './welcomeDocuments.js';

/**
 * The player's half of the new-player welcome. Added 2026-10-05.
 *
 * In order, a player sees: the checklist, if a sheet was made for them and is not finished; "your request
 * is in", while one waits for a GM; why it was turned down, if it was; otherwise, with no character of
 * their own here and a campaign party to join, the welcome itself. With an extra sheet from ComeOnOverUno
 * (2026-10-12), the welcome comes back once more, saying it is their second; companion sheets never count.
 * With Dual Class on (2026-10-20), the welcome also asks one class or two (`welcomeDualClass.ts`), and the
 * checklist has a step for each variant rule that is on (`variantSteps.ts`).
 *
 * ⚠️ Everything is worked out again from the documents on every change (`refresh`), never stepped through
 *    as a sequence, so a reload, a second tab or a GM finishing it all lands on the same screen.
 *
 * ⚠️ A face the player closed stays closed until something changes it, and the welcome is never redrawn
 *    while it shows, which would wipe a half-typed name.
 */
export const GUIDE_DONE_FLAG = 'buildGuideDone';

export function startWelcome(
  hooks: WelcomeHooks,
  settings: WelcomeSettings,
  globals: WelcomeGlobals & {
    readonly crypto?: { randomUUID?(): string };
    readonly game?: ChoiceGame;
  },
  doc: Document,
  summon: () => void = () => undefined
): void {
  const game = (): WelcomeGlobals['game'] => globals.game;
  if (game()?.user?.isGM === true) {
    return;
  }
  const me = (): NonNullable<WelcomeGlobals['game']>['user'] => game()?.user;
  const closed = new Set<string>();
  let showing: string | null = null;
  let opened: string | null = null;
  const wake = new HelperWake(summon);
  const offer = new ClassOffer(async () => classChoices(game()), refresh);
  const rules = (): ReturnType<typeof variantRules> => variantRules(settings, game()?.system?.id);

  const guided = (): WelcomeActor | undefined =>
    ownCharacters(game()).find(
      (actor) =>
        typeof actor.getFlag?.(MODULE_ID, MADE_FOR_FLAG) === 'string' &&
        actor.getFlag(MODULE_ID, GUIDE_DONE_FLAG) !== true
    );

  const welcome = new WelcomeWindow(doc, {
    create: (name, partyUuid, importBuild, dualClass) => {
      const id = globals.crypto?.randomUUID?.() ?? `${String(Date.now())}-${String(Math.random())}`;
      void askForSheet(me(), { id, name, partyUuid, at: Date.now(), importBuild }, dualClass);
    },
    later: () => {
      dismiss();
    },
    retry: () => {
      void me()?.unsetFlag?.(MODULE_ID, RESULT_FLAG);
    },
  });
  const guide = new GuidePanel(doc, {
    openSheet: () => guided()?.sheet?.render?.(true),
    hide: () => {
      closed.add('guide');
      guide.close();
    },
    finish: () => {
      void guided()?.setFlag?.(MODULE_ID, GUIDE_DONE_FLAG, true);
      guide.close();
    },
    /* The Dual class window, already set to this sheet (`startDualClassPlayer` reads `detail`). */
    pickDualClass: () =>
      doc.dispatchEvent(new CustomEvent(DUAL_CLASS_EVENT, { detail: { actorId: guided()?.id } })),
  });

  function dismiss(): void {
    if (showing !== null) closed.add(showing);
    showing = null;
    welcome.close();
  }

  function face(key: string, next: WelcomeFace): void {
    if (closed.has(key) || showing === key) {
      return;
    }
    showing = key;
    welcome.show(next);
  }

  function refresh(): void {
    if (settings.get(MODULE_ID, WELCOME_SETTING) !== true) {
      dismiss();
      guide.close();
      return;
    }
    const actor = guided();
    if (actor !== undefined) {
      welcome.close();
      showing = null;
      showGuide(actor);
      return;
    }
    guide.close();
    const request = readSheetRequest(me()?.getFlag?.(MODULE_ID, REQUEST_FLAG));
    if (request !== null) {
      wake.forRequest(request.id);
      face(`waiting:${request.id}`, {
        kind: 'waiting',
        gmOnline: readGmPresence({ getGame: game }).online,
      });
      return;
    }
    const result = readSheetResult(me()?.getFlag?.(MODULE_ID, RESULT_FLAG));
    if (result?.kind === 'refused') {
      face(`refused:${result.requestId}`, { kind: 'refused', reason: result.reason });
      return;
    }
    const myId = me()?.id ?? '';
    const parties = offeredParties(sharedParties(settings), campaignsOf(settings, myId));
    const owned = countedCharacters(game()).length;
    if (owned >= allowedSheets(settings, myId)) {
      dismiss();
      return;
    }
    if (parties.length === 0) {
      /* No list shared yet: ask once for COO's helper GM, whose Tongs shares it (partyListWork.ts). */
      wake.forPartyList();
      dismiss();
      return;
    }
    /* Dual Class on: wait for the classes, then offer them. Off, or under two classes: as it always was. */
    const classes = rules().dualClass ? offer.get() : [];
    if (classes === undefined) {
      return;
    }
    const world = game()?.world?.title ?? 'the game';
    const dual = classes.length >= 2 ? { classes } : {};
    face(`ask:${String(owned)}`, { kind: 'ask', world, parties, second: owned > 0, ...dual });
  }

  /** The sheet opens by itself once, the first time this browser sees it made. */
  function showGuide(actor: WelcomeActor): void {
    if (
      opened !== actor.uuid &&
      readSheetResult(me()?.getFlag?.(MODULE_ID, RESULT_FLAG)) !== null
    ) {
      opened = actor.uuid;
      actor.sheet?.render?.(true);
      void me()?.unsetFlag?.(MODULE_ID, RESULT_FLAG);
    }
    if (!closed.has('guide')) {
      guide.show(actor.name ?? 'your character', guideSteps(guideView(actor), rules()));
    }
  }

  const events = ['updateUser', 'userConnected', 'createActor', 'updateActor', 'deleteActor'];
  for (const name of [
    ...events,
    'createItem',
    'updateItem',
    'deleteItem',
    'updateSetting',
    'createSetting',
  ]) {
    hooks.on(name, refresh);
  }
  refresh();
  startWelcomeDualClass(hooks, globals, summon);
}
