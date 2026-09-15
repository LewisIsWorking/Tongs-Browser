import type { SeenAttacker } from './attackerView.js';
import { MANUAL_CAUSE, describeCause, describePublicCause } from './bandCause.js';
import type { BandCause, CauseFacts, IwrApplication } from './bandCause.js';

/**
 * Waiting for PF2e to say why an actor's HP just changed. Added 2026-09-15.
 *
 * ⛔ THE CARD COMES AFTER THE CHANGE. Read from pf2e 8.5.0's `applyDamage`: the actor is updated first,
 * and only then is the damage-taken card created. So the watch is armed at `updateActor`, before any
 * await, and a card for that actor within the window is the cause. No card means nothing in PF2e
 * applied it, which is a manual change.
 *
 * ⚠️ Matched on `appliedDamage.uuid`, the ACTOR's uuid. For an unlinked token that is its synthetic
 * actor (`Scene.S.Token.T.Actor.A`), the same uuid the `updateActor` hook hands over.
 */
export interface DamageTakenMessage {
  readonly flags?: Readonly<Record<string, unknown>>;
  readonly content?: string;
}

export interface CauseHooks {
  on(name: string, fn: (...args: never[]) => unknown): number;
  off(name: string, id: number): void;
}

interface TakenFlags {
  readonly context?: { readonly type?: string };
  readonly appliedDamage?: { readonly uuid?: string; readonly isHealing?: boolean } | null;
  readonly origin?: { readonly uuid?: string; readonly actor?: string } | null;
}

const flagsOf = (message: DamageTakenMessage, systemId: string) =>
  (message.flags?.[systemId] ?? {}) as TakenFlags;

const ENTITIES: Readonly<Record<string, string>> = {
  quot: '"',
  amp: '&',
  lt: '<',
  gt: '>',
  '#39': "'",
};

/** The IWR PF2e applied, from the card's `data-applications` attribute; none when it is absent or odd. */
export function readIwr(content: string): IwrApplication[] {
  const raw = /data-applications="([^"]*)"/.exec(content)?.[1];
  if (raw === undefined) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(
      raw.replace(/&(quot|amp|lt|gt|#39);/g, (_all, name: string) => String(ENTITIES[name]))
    );
    return Array.isArray(parsed)
      ? parsed.filter(
          (each): each is IwrApplication =>
            typeof (each as IwrApplication).category === 'string' &&
            typeof (each as IwrApplication).type === 'string' &&
            typeof (each as IwrApplication).adjustment === 'number'
        )
      : [];
  } catch {
    return [];
  }
}

export function readCauseFacts(
  message: DamageTakenMessage,
  systemId: string,
  nameOf: (uuid: string) => string | null
): CauseFacts {
  const flags = flagsOf(message, systemId);
  const name = (uuid: string | undefined) => (uuid === undefined ? null : nameOf(uuid));
  return {
    itemName: name(flags.origin?.uuid),
    actorName: name(flags.origin?.actor),
    healing: flags.appliedDamage?.isHealing === true,
    iwr: readIwr(message.content ?? ''),
  };
}

/**
 * Resolves with PF2e's damage-taken card for this actor within the window, or null when none came. Both the
 * GM's cause and the public one read the same card, each through its own watch armed at the same moment.
 */
async function watchDamageTaken(
  hooks: CauseHooks,
  systemId: string,
  actorUuid: string,
  timeoutMs: number
): Promise<DamageTakenMessage | null> {
  return new Promise<DamageTakenMessage | null>((resolve) => {
    const hookId = hooks.on('createChatMessage', (message: DamageTakenMessage) => {
      const flags = flagsOf(message, systemId);
      if (flags.context?.type === 'damage-taken' && flags.appliedDamage?.uuid === actorUuid) {
        finish(message);
      }
    });
    const timer = setTimeout(() => {
      finish(null);
    }, timeoutMs);

    /* ⚠️ One `finish`, so a card and the timeout can never both unhook or both resolve. */
    function finish(message: DamageTakenMessage | null): void {
      hooks.off('createChatMessage', hookId);
      clearTimeout(timer);
      resolve(message);
    }
  });
}

/** Who and what dealt it, as uuids, and which way it went; read off the card for the public line. */
function readOrigin(
  message: DamageTakenMessage,
  systemId: string
): {
  readonly itemUuid: string | null;
  readonly actorUuid: string | null;
  readonly healing: boolean;
} {
  const flags = flagsOf(message, systemId);
  return {
    itemUuid: flags.origin?.uuid ?? null,
    actorUuid: flags.origin?.actor ?? null,
    healing: flags.appliedDamage?.isHealing === true,
  };
}

/**
 * Resolves with the cause of this actor's change, read ONCE from PF2e's card within the window: the GM's
 * wording, and the table's when `seen` says players can see who dealt it. No card is a manual change,
 * which the table is never told about.
 */
export async function watchCause(
  hooks: CauseHooks,
  systemId: string,
  actorUuid: string,
  timeoutMs: number,
  nameOf: (uuid: string) => string | null,
  seen: (attackerUuid: string) => SeenAttacker | null = () => null
): Promise<BandCause> {
  const message = await watchDamageTaken(hooks, systemId, actorUuid, timeoutMs);
  if (message === null) {
    return { gm: MANUAL_CAUSE, shown: null };
  }
  const origin = readOrigin(message, systemId);
  const attacker = origin.actorUuid === null ? null : seen(origin.actorUuid);
  const item = origin.itemUuid === null ? null : nameOf(origin.itemUuid);
  return {
    gm: describeCause(readCauseFacts(message, systemId, nameOf)),
    shown:
      attacker === null
        ? null
        : { text: describePublicCause(item, attacker.name, origin.healing), attacker },
  };
}
