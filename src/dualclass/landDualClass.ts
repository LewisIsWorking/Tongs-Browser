import { MODULE_ID } from '../constants.js';
import { DUAL_FOR_FLAG } from './dualClassRequest.js';
import type { DualClassResult } from './dualClassRequest.js';

/**
 * Putting the GM's dual class item on the player's sheet, in the PLAYER's browser. Added 2026-10-12.
 *
 * ⭐ Why the player's browser and not the GM's: PF2e asks a class's choices (the Fighter's skill, the
 *    Wizard's school) on the screen of whoever adds the class, as the welcome measured live (see
 *    `welcome/README.md`, "An import is applied in the PLAYER's browser"). Added by the GM's browser,
 *    the GM would be asked the player's choices mid-session, and ComeOnOverUno's hidden helper GM would
 *    wait on a dialog nobody can see, holding up every request after it. A player may add items to a
 *    sheet they own, so nothing here needs a GM's permission; Foundry's server still refuses a sheet
 *    they do not own.
 *
 * ⭐ PF2e replaces the class itself. `ItemPF2e.createDocuments` deletes the actor's existing class (and,
 *    through the creature's delete, the features it granted) before it creates a new one, as when a
 *    class is dropped on a sheet. ⚠️ Then exactly ONE class is made sure of: any class left that is not
 *    this request's is deleted, and of two copies of this one (two tabs landing it at once) the same one
 *    is kept in every tab, so the tabs never delete each other's.
 */
export interface LandingItem {
  readonly id: string | null;
  readonly type: string;
  getFlag?(scope: string, key: string): unknown;
}

export interface LandingActor {
  readonly name: string | null;
  readonly isOwner?: boolean;
  readonly items: { readonly contents: readonly LandingItem[] };
  createEmbeddedDocuments(type: 'Item', data: readonly object[]): Promise<unknown>;
  deleteEmbeddedDocuments(type: 'Item', ids: readonly string[]): Promise<unknown>;
}

export type Landing =
  | { readonly kind: 'landed' | 'already'; readonly actorName: string }
  | { readonly kind: 'failed'; readonly reason: string };

type Built = Extract<DualClassResult, { kind: 'built' }>;

export async function landDualClass(
  actor: LandingActor | undefined,
  result: Built
): Promise<Landing> {
  if (actor?.isOwner !== true) {
    return { kind: 'failed', reason: 'That character sheet is not yours to change any more.' };
  }
  const actorName = actor.name ?? 'Your character';
  const ours = (item: LandingItem): boolean =>
    item.type === 'class' && item.getFlag?.(MODULE_ID, DUAL_FOR_FLAG) === result.requestId;
  const already = actor.items.contents.some(ours);
  if (!already) {
    await actor.createEmbeddedDocuments('Item', [result.item]);
    if (!actor.items.contents.some(ours)) {
      return {
        kind: 'failed',
        reason: `PF2e would not add the ${result.item.name} class to ${actorName}.`,
      };
    }
  }
  await keepOneClass(actor, ours);
  return { kind: already ? 'already' : 'landed', actorName };
}

async function keepOneClass(
  actor: LandingActor,
  ours: (item: LandingItem) => boolean
): Promise<void> {
  const classes = actor.items.contents.filter((item) => item.type === 'class');
  /* ⚠️ Only real ids: one with none must never be "kept" and get every other copy deleted. */
  const keep = classes
    .filter(ours)
    .flatMap((item) => (item.id === null ? [] : [item.id]))
    .sort()[0];
  const extra = classes.flatMap((item) => (item.id !== null && item.id !== keep ? [item.id] : []));
  if (extra.length > 0) {
    await actor.deleteEmbeddedDocuments('Item', extra);
  }
}
