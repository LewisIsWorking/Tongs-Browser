import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { readGmPresence } from '../foundry/DesignatedGm.js';
import type { GmGame } from '../foundry/DesignatedGm.js';
import { countedCharacters } from '../welcome/welcomeDocuments.js';
import type { WelcomeGame } from '../welcome/welcomeDocuments.js';
import { classChoices, variantOff } from './classChoices.js';
import { isBag } from './classFields.js';
import type { ChoiceGame } from './classChoices.js';
import {
  DUAL_REQUEST_FLAG,
  DUAL_RESULT_FLAG,
  readDualClassRequest,
  readDualClassResult,
} from './dualClassRequest.js';
import { DualClassWindow } from './DualClassWindow.js';
import { landDualClass } from './landDualClass.js';
import type { LandingActor } from './landDualClass.js';

/**
 * The player's half of dual class: the window, the request, and landing the answer. Added 2026-10-12.
 *
 * The tray's "Dual class…" button sends `DUAL_CLASS_EVENT` on the document; this is what hears it. The
 * answer is read from the player's own user on every `updateUser` and once at start, so an answer that
 * arrived while they were away lands at their next visit.
 *
 * ⚠️ A player with no request never sees or writes anything: the window only opens from the button.
 * The welcome's checklist (2026-10-20) sends the same event with `detail.actorId`, its new sheet, which
 * the window starts on; an id that is not one of the player's own sheets is ignored.
 */
export const DUAL_CLASS_EVENT = 'tongs-dual-class';

export interface DualClassMe {
  readonly id: string | null;
  readonly isGM?: boolean;
  getFlag?(scope: string, key: string): unknown;
  setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
  unsetFlag?(scope: string, key: string): Promise<unknown>;
}

export interface DualClassPlayerGlobals {
  readonly game?: Omit<WelcomeGame, 'user'> &
    GmGame &
    ChoiceGame & {
      readonly user?: DualClassMe;
      readonly actors?: { get(id: string): LandingActor | undefined };
    };
  readonly ui?: { readonly notifications?: { info?(message: string): unknown } };
  readonly crypto?: { randomUUID?(): string };
}

export function startDualClassPlayer(
  hooks: { on(name: string, fn: () => unknown): unknown },
  globals: DualClassPlayerGlobals,
  doc: Document
): void {
  const game = (): DualClassPlayerGlobals['game'] => globals.game;
  if (game()?.user?.isGM === true) {
    return;
  }
  const me = (): DualClassMe | undefined => game()?.user;
  const tell = (text: string): unknown => globals.ui?.notifications?.info?.(text);
  let busy = false;

  const window = new DualClassWindow(doc, (actorId, first, second) => {
    const id = globals.crypto?.randomUUID?.() ?? `${String(Date.now())}-${String(Math.random())}`;
    void me()
      ?.unsetFlag?.(MODULE_ID, DUAL_RESULT_FLAG)
      .then(async () =>
        me()?.setFlag?.(MODULE_ID, DUAL_REQUEST_FLAG, {
          id,
          actorId,
          first,
          second,
          at: Date.now(),
        })
      );
    window.show({ kind: 'waiting', gmOnline: readGmPresence({ getGame: game }).online });
  });

  async function open(chosen: unknown): Promise<void> {
    if (readDualClassRequest(me()?.getFlag?.(MODULE_ID, DUAL_REQUEST_FLAG)) !== null) {
      window.show({ kind: 'waiting', gmOnline: readGmPresence({ getGame: game }).online });
      return;
    }
    const sheets = countedCharacters(game()).flatMap((actor) =>
      actor.id === null ? [] : [{ id: actor.id, name: actor.name ?? 'A character' }]
    );
    if (sheets.length === 0) {
      window.show({
        kind: 'message',
        title: 'No character yet',
        text: 'You have no character sheet of your own in this world to give a dual class to.',
      });
      return;
    }
    const classes = await classChoices(game());
    if (classes.length < 2) {
      window.show({
        kind: 'message',
        title: 'No classes to pick from',
        text: "This world has none of the class compendiums dual classing reads. Ask your GM to switch on PF2e's (or SF2e's) classes.",
      });
      return;
    }
    const selected = sheets.find((sheet) => sheet.id === chosen)?.id;
    window.show({
      kind: 'ask',
      sheets,
      classes,
      variantOff: variantOff(game()),
      ...(selected === undefined ? {} : { selected }),
    });
  }

  /** The GM's answer: a refusal is shown, a dual class is landed on the sheet. Either is then cleared. */
  async function answered(): Promise<void> {
    const result = readDualClassResult(me()?.getFlag?.(MODULE_ID, DUAL_RESULT_FLAG));
    if (result === null || busy) {
      return;
    }
    busy = true;
    try {
      if (result.kind === 'refused') {
        window.show({ kind: 'message', title: 'No dual class this time', text: result.reason });
      } else {
        const landing = await landDualClass(game()?.actors?.get(result.actorId), result);
        const text =
          landing.kind === 'failed'
            ? landing.reason
            : `${landing.actorName} is now a ${result.item.name}. PF2e may ask you to choose class features.`;
        window.show({
          kind: 'message',
          title: landing.kind === 'failed' ? 'That did not work' : 'Dual class done',
          text,
        });
        tell(text);
      }
      await me()?.unsetFlag?.(MODULE_ID, DUAL_RESULT_FLAG);
    } catch (error: unknown) {
      /* ⚠️ Kept, not cleared: the answer lands at the next change or visit instead of being lost. */
      logger.warn(
        `Dual class did not land: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      busy = false;
    }
  }

  doc.addEventListener(DUAL_CLASS_EVENT, (event) => {
    const detail: unknown = (event as Partial<CustomEvent>).detail;
    void open(isBag(detail) ? detail['actorId'] : undefined);
  });
  hooks.on('updateUser', () => void answered());
  void answered();
}
