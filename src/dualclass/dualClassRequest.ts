import { isBag } from './classFields.js';
import type { DualClassItem } from './buildDualClass.js';

/**
 * A player's request for a dual class, and the GM's answer. Added 2026-10-12.
 *
 * ⭐ It travels as the welcome's sheet request does (`welcome/sheetRequest.ts`): a flag on the player's
 *    OWN user, which Foundry lets nobody else write, so the GM's browser knows who asked. The answer
 *    comes back on the same user.
 */
export const DUAL_REQUEST_FLAG = 'dualClassRequest';
export const DUAL_RESULT_FLAG = 'dualClassResult';
/** On the dual class item itself, so an answer landed twice (two tabs, a reload) adds one class. */
export const DUAL_FOR_FLAG = 'dualClassFor';

/**
 * Where classes come from: the macro's list, in its order, plus SF2e's own.
 *
 * ⚠️ `sf2e.classes` is the one addition. The macro predates the SF2e system, and Lewis wants this in
 *    every PF2e AND SF2e world; without it an SF2e world offers no classes at all. A pack this world
 *    does not have is skipped, as the macro's `game.packs.filter` skipped it.
 */
export const CLASS_PACKS: readonly string[] = [
  'pf2e.classes',
  'battlezoo-eldamon-pf2e.classes',
  'sf2e-anachronism.classes',
  'starfinder-field-test-for-pf2e.classes',
  'pf2e-playtest-data.battlecry-playtest-classes',
  'pf2e-playtest-data.impossible-playtest-classes',
  'sf2e.classes',
];

/** The pack a compendium UUID names (`Compendium.pf2e.classes.Item.abc` is `pf2e.classes`), or null. */
export function packOf(uuid: string): string | null {
  return /^Compendium\.([^.]+\.[^.]+)\./.exec(uuid)?.[1] ?? null;
}

export interface DualClassRequest {
  readonly id: string;
  /** A world actor's id: the player's own character sheet. */
  readonly actorId: string;
  /** The 1st class, which the item is built on (Kineticist must be this one). */
  readonly first: string;
  readonly second: string;
  readonly at: number;
}

export type DualClassResult =
  | {
      readonly kind: 'built';
      readonly requestId: string;
      readonly actorId: string;
      readonly item: DualClassItem;
    }
  | { readonly kind: 'refused'; readonly requestId: string; readonly reason: string };

const text = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** ⚠️ Untrusted: any player can write this flag by hand. Anything off-shape is no request at all. */
export function readDualClassRequest(raw: unknown): DualClassRequest | null {
  if (!isBag(raw)) {
    return null;
  }
  const { id, actorId, first, second, at } = raw;
  return text(id) && text(actorId) && text(first) && text(second) && typeof at === 'number'
    ? { id, actorId, first, second, at }
    : null;
}

/** The GM's answer, read in the player's browser. Written by a GM, still read as untrusted. */
export function readDualClassResult(raw: unknown): DualClassResult | null {
  if (!isBag(raw) || !text(raw['requestId'])) {
    return null;
  }
  const requestId = raw['requestId'];
  const item = raw['item'];
  if (
    raw['kind'] === 'built' &&
    text(raw['actorId']) &&
    isBag(item) &&
    item['type'] === 'class' &&
    text(item['name']) &&
    isBag(item['system'])
  ) {
    return {
      kind: 'built',
      requestId,
      actorId: raw['actorId'],
      item: item as unknown as DualClassItem,
    };
  }
  if (raw['kind'] === 'refused' && text(raw['reason'])) {
    return { kind: 'refused', requestId, reason: raw['reason'] };
  }
  return null;
}
