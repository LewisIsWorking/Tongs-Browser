import { CLASS_PACKS } from './dualClassRequest.js';
import type { ClassChoice } from './DualClassWindow.js';

/**
 * What the window offers: every class in the class compendiums this world has, by name. Added 2026-10-12.
 *
 * ⚠️ Read in the PLAYER's browser, from compendium indexes, which PF2e opens to players (its class packs
 *    are `PLAYER: OBSERVER`). A pack this world lacks, or one this player cannot open, is skipped, and an
 *    entry that is not a class is left out rather than refusing them all as the macro did.
 * ⚠️ A name two packs share (a playtest Fighter beside PF2e's) is told apart by the pack's label.
 */
export interface ChoiceGame {
  readonly packs?: {
    get(key: string):
      | {
          readonly metadata?: { readonly label?: string };
          getIndex(): Promise<{ values(): Iterable<unknown> }>;
        }
      | undefined;
  };
  readonly system?: { readonly id?: string };
  readonly settings?: {
    readonly settings?: { has(key: string): boolean };
    get(namespace: string, key: string): unknown;
  };
}

export async function classChoices(game: ChoiceGame | undefined): Promise<ClassChoice[]> {
  const found: (ClassChoice & { readonly pack: string })[] = [];
  for (const key of CLASS_PACKS) {
    const pack = game?.packs?.get(key);
    if (pack === undefined) {
      continue;
    }
    for (const entry of (await pack.getIndex()).values()) {
      const { type, uuid, name } = entry as Record<string, unknown>;
      if (type === 'class' && typeof uuid === 'string' && typeof name === 'string') {
        found.push({ uuid, name, pack: pack.metadata?.label ?? key });
      }
    }
  }
  const named = (name: string): number => found.filter((each) => each.name === name).length;
  return found
    .map((each) => ({
      uuid: each.uuid,
      name: named(each.name) > 1 ? `${each.name} (${each.pack})` : each.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Whether this world's Dual Class variant rule is registered AND switched off, so the window can say so.
 * ⚠️ Lewis assumes it is on in every world. Checked by key, because reading a setting nobody registered
 *    throws in Foundry; a system with no such setting reads as not off and nothing is said.
 */
export function variantOff(game: ChoiceGame | undefined): boolean {
  const system = game?.system?.id ?? 'pf2e';
  return (
    game?.settings?.settings?.has(`${system}.dualClassVariant`) === true &&
    game.settings.get(system, 'dualClassVariant') === false
  );
}
