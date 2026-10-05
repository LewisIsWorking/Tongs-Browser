import { MODULE_ID } from '../constants.js';
import { readGmPresence } from '../foundry/DesignatedGm.js';
import { guideSteps } from './buildGuide.js';
import { GuidePanel } from './GuidePanel.js';
import { storedImport } from './importBuild.js';
import {
  MADE_FOR_FLAG,
  REQUEST_FLAG,
  RESULT_FLAG,
  cleanName,
  readSheetRequest,
  readSheetResult,
} from './sheetRequest.js';
import { sharedParties, WELCOME_SETTING } from './startSheetRequests.js';
import type { WelcomeGlobals, WelcomeHooks, WelcomeSettings } from './startSheetRequests.js';
import { WelcomeWindow } from './WelcomeWindow.js';
import type { WelcomeFace } from './WelcomeWindow.js';
import { gearCount, ownCharacters } from './welcomeDocuments.js';
import type { WelcomeActor } from './welcomeDocuments.js';

/**
 * The player's half of the new-player welcome. Added 2026-10-05.
 *
 * In order, a player sees: the checklist, if a sheet was made for them and is not finished; "your request
 * is in", while one waits for a GM; why it was turned down, if it was; otherwise, with no character of
 * their own here and a campaign party to join, the welcome itself.
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
  globals: WelcomeGlobals & { readonly crypto?: { randomUUID?(): string } },
  doc: Document
): void {
  const game = (): WelcomeGlobals['game'] => globals.game;
  if (game()?.user?.isGM === true) {
    return;
  }
  const me = (): NonNullable<WelcomeGlobals['game']>['user'] => game()?.user;
  const closed = new Set<string>();
  let showing: string | null = null;
  let opened: string | null = null;

  const guided = (): WelcomeActor | undefined =>
    ownCharacters(game()).find(
      (actor) =>
        typeof actor.getFlag?.(MODULE_ID, MADE_FOR_FLAG) === 'string' &&
        actor.getFlag(MODULE_ID, GUIDE_DONE_FLAG) !== true
    );

  const welcome = new WelcomeWindow(doc, {
    create: (name, partyUuid, importBuild) => {
      const id = globals.crypto?.randomUUID?.() ?? `${String(Date.now())}-${String(Math.random())}`;
      void me()
        ?.unsetFlag?.(MODULE_ID, RESULT_FLAG)
        .then(async () =>
          me()?.setFlag?.(MODULE_ID, REQUEST_FLAG, {
            id,
            name: cleanName(name),
            partyUuid,
            at: Date.now(),
            importBuild: importBuild === null ? null : storedImport(importBuild),
          })
        );
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
    const parties = sharedParties(settings);
    if (ownCharacters(game()).length > 0 || parties.length === 0) {
      dismiss();
      return;
    }
    face('ask', { kind: 'ask', world: game()?.world?.title ?? 'the game', parties });
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
      /* ⛔ Named one by one, never spread: `ancestry`, `class` and the rest are getters on PF2e's actor
         class, and a spread copies only own properties, so every step would read as not done. */
      const view = {
        ancestry: actor.ancestry ?? null,
        heritage: actor.heritage ?? null,
        background: actor.background ?? null,
        class: actor.class ?? null,
        ...(actor.system === undefined ? {} : { system: actor.system }),
        gearCount: gearCount(actor),
      };
      guide.show(actor.name ?? 'your character', guideSteps(view));
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
}
