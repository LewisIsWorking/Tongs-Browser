import { damageAmounts } from './damageAmounts.js';
import type { AlterableRoll } from './damageAmounts.js';
import type { DamageFacts, MessageFacts, SaveFacts, TargetFacts } from './deckFacts.js';

/**
 * Turning a real PF2e or SF2e chat message into the facts the deck decides from. Added 2026-09-13.
 *
 * ⛔ BUILT AGAINST A MEASURED MESSAGE, not a guessed one. Every path read below was printed from a
 * genuine strike on pf2e 8.5.0 (a Fire Mephit's Jaws against a Xorn, 2026-09-13):
 *
 *     isDamageRoll            true
 *     flags.pf2e.context      { type: "damage-roll", sourceType: "attack", outcome: "success",
 *                               target: { actor: "Scene.X.Token.Y.Actor.Z", token: "Scene.X.Token.Y" } }
 *     rolls[0].total          6
 *     rolls[0].instances      [{ type: "piercing", total: 5 }, { type: "fire", total: 1 }]
 *
 * ⚠️ `flags[systemId]`, never `flags.pf2e`. SF2e is the same code with its flags under `sf2e`, measured
 * by diffing both installed bundles, so the system id is passed in rather than written here.
 *
 * ⚠️ SAVES are read from the message's stored `content`, through a port, because finding PF2e's save
 * controls needs an HTML parser and this file runs anywhere. See `readSaveControls.ts` for the measured
 * shape.
 */

/** The shared marker's home: this module's own flag scope, which phase 2's automation reads too. */
export const MODULE_ID = 'tongs-browser';
export const HANDLED_FLAG = 'handled';
/** Why phase 2's automation left a card for the GM, written on the card. See `automation/AutoApply.ts`. */
export const AUTO_NOTE_FLAG = 'autoDeclined';

/** As much of a damage roll as this reads. */
export interface RollLike extends AlterableRoll {
  readonly instances?: readonly { readonly type?: string }[];
}

/** As much of a chat message as this reads. */
export interface MessageLike {
  readonly id: string;
  readonly timestamp: number;
  readonly isDamageRoll?: boolean;
  readonly rolls?: readonly RollLike[];
  readonly flags?: Readonly<Record<string, unknown>>;
  /** The stored HTML, where PF2e's save controls live. */
  readonly content?: string;
  /** Foundry's own display name for the speaker. */
  readonly alias?: string;
  /** PF2e's item the message came from. */
  readonly item?: { readonly name?: string } | null;
}

export interface ReadPorts {
  /** `game.system.id`: `pf2e` or `sf2e`. */
  readonly systemId: string;
  /** The name to show for a token, or null when the token no longer resolves. */
  readonly tokenName: (tokenUuid: string) => string | null;
  /** The saves PF2e's own controls in this HTML ask for. */
  readonly saveControls: (content: string) => SaveFacts[];
}

interface SystemContext {
  readonly target?: { readonly token?: string } | null;
}

function systemContext(message: MessageLike, systemId: string): SystemContext {
  const scope = message.flags?.[systemId] as { context?: SystemContext } | undefined;
  return scope?.context ?? {};
}

/**
 * ⚠️ One entry per roll that has damage instances, numbered as PF2e numbers them, because PF2e's own
 * apply takes a `rollIndex` and a message can carry more than one damage roll.
 */
function readDamage(message: MessageLike): DamageFacts[] {
  if (message.isDamageRoll !== true) {
    return [];
  }
  const damage: DamageFacts[] = [];
  (message.rolls ?? []).forEach((roll, rollIndex) => {
    if (roll.instances === undefined || roll.instances.length === 0) {
      return;
    }
    const types = [
      ...new Set(roll.instances.map((instance) => instance.type ?? '').filter(Boolean)),
    ];
    damage.push({ rollIndex, total: roll.total ?? 0, types, amounts: damageAmounts(roll) });
  });
  return damage;
}

/**
 * ⛔ A TARGET THAT NO LONGER RESOLVES IS NO TARGET. The token may have been deleted since the roll, and
 * a card naming a creature that is not there would apply damage to nothing. It reads as null, which is
 * the "ask the GM" case, rather than as a stale name on a button.
 */
function readTarget(context: SystemContext, ports: ReadPorts): TargetFacts | null {
  const tokenUuid = context.target?.token;
  if (typeof tokenUuid !== 'string' || tokenUuid.length === 0) {
    return null;
  }
  const name = ports.tokenName(tokenUuid);
  return name === null ? null : { tokenUuid, name };
}

function readHandled(message: MessageLike): boolean {
  const scope = message.flags?.[MODULE_ID] as Record<string, unknown> | undefined;
  return scope?.[HANDLED_FLAG] === true;
}

function readNote(message: MessageLike): { note?: string } {
  const note = (message.flags?.[MODULE_ID] as Record<string, unknown> | undefined)?.[
    AUTO_NOTE_FLAG
  ];
  return typeof note === 'string' ? { note } : {};
}

export function readMessageFacts(message: MessageLike, ports: ReadPorts): MessageFacts {
  return {
    id: message.id,
    speaker: message.alias ?? '',
    title: message.item?.name ?? null,
    timestamp: message.timestamp,
    damage: readDamage(message),
    saves: message.content === undefined ? [] : ports.saveControls(message.content),
    target: readTarget(systemContext(message, ports.systemId), ports),
    handled: readHandled(message),
    ...readNote(message),
  };
}
