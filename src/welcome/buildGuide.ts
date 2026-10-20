import { variantSteps } from './variantSteps.js';
import type { VariantRules } from './variantRules.js';

/**
 * The new player's checklist: what their sheet still needs. Added 2026-10-05.
 *
 * Every tick is READ from the sheet, never remembered, so it is right however the player filled it in
 * (the sheet's own buttons, dragging from a compendium, or a GM doing it for them).
 *
 * ⚠️ Shapes measured on PF2e 8.5 (local Foundry, 2026-10-05): `actor.ancestry`/`heritage`/`background`/
 *    `class` are the items or null; an empty sheet has `system.build.attributes.allowedBoosts["1"] = 4` and
 *    `boosts["1"] = []`; an ancestry's own boosts are `system.boosts.<slot>.{value, selected}`, unpicked
 *    while `selected` is null.
 */
export interface BoostSlot {
  readonly value?: readonly string[];
  readonly selected?: string | null;
}

export interface GuideItem {
  readonly name?: string;
  readonly system?: {
    readonly boosts?: Readonly<Record<string, BoostSlot>>;
    readonly keyAbility?: { readonly value?: readonly string[]; readonly selected?: string | null };
  };
}

export interface GuideActor {
  readonly ancestry?: GuideItem | null;
  readonly heritage?: GuideItem | null;
  readonly background?: GuideItem | null;
  readonly class?: GuideItem | null;
  readonly system?: {
    readonly build?: {
      readonly attributes?: {
        readonly manual?: boolean;
        readonly boosts?: Readonly<Record<string, unknown>>;
        readonly allowedBoosts?: Readonly<Record<string, number>>;
      };
    };
  };
  /** Weapons, armour and other gear, counted. */
  readonly gearCount: number;
  /** The name of the dual class Tongs gave this sheet, or null (2026-10-20, `variantSteps.ts`). */
  readonly dualClass?: string | null;
  /** Feats in PF2e Workbench's Ancestry Paragon section of the Feats tab. */
  readonly paragonFeats?: number;
}

export interface GuideStep {
  readonly key: string;
  readonly label: string;
  readonly done: boolean;
  /** What it is set to, when it is: "Human", "Fighter". */
  readonly detail: string | null;
  /** A line under the step saying what to do (2026-10-20, the variant rules' steps). */
  readonly note?: string;
  /** It never holds back "ready": the player may skip it, or Tongs cannot read it from the sheet. */
  readonly optional?: boolean;
  /** A button on the step: `dualClass` opens the Dual class window for this sheet. */
  readonly action?: 'dualClass';
}

function picked(item: GuideItem | null | undefined): Pick<GuideStep, 'done' | 'detail'> {
  const name = item?.name ?? null;
  return { done: item !== null && item !== undefined, detail: name };
}

/** Every boost slot that offers a choice has had one made. */
function slotsChosen(item: GuideItem | null | undefined): boolean {
  const slots = Object.values(item?.system?.boosts ?? {});
  return slots.every((slot) => (slot.value?.length ?? 0) <= 1 || typeof slot.selected === 'string');
}

/**
 * ⚠️ Boosts count as done only once the ancestry, background AND class are on the sheet: before then
 *    there is nothing to choose from, and an early tick would read as "nothing to do here".
 */
function boostsDone(actor: GuideActor): boolean {
  const build = actor.system?.build?.attributes;
  if (build?.manual === true) {
    return true;
  }
  if (!actor.ancestry || !actor.background || !actor.class) {
    return false;
  }
  const free = build?.boosts?.['1'];
  const allowed = build?.allowedBoosts?.['1'] ?? 0;
  const key = actor.class.system?.keyAbility;
  const keyChosen = (key?.value?.length ?? 0) <= 1 || typeof key?.selected === 'string';
  return (
    Array.isArray(free) &&
    free.length >= allowed &&
    keyChosen &&
    slotsChosen(actor.ancestry) &&
    slotsChosen(actor.background)
  );
}

/** The basics, then a step for each variant rule this world has on (none when `rules` is left out). */
export function guideSteps(actor: GuideActor, rules?: VariantRules): GuideStep[] {
  return [
    { key: 'ancestry', label: 'Ancestry', ...picked(actor.ancestry) },
    { key: 'heritage', label: 'Heritage', ...picked(actor.heritage) },
    { key: 'background', label: 'Background', ...picked(actor.background) },
    { key: 'class', label: 'Class', ...picked(actor.class) },
    { key: 'boosts', label: 'Attribute boosts', done: boostsDone(actor), detail: null },
    {
      key: 'gear',
      label: 'Equipment',
      done: actor.gearCount > 0,
      detail: actor.gearCount > 0 ? `${String(actor.gearCount)} items` : null,
    },
    ...(rules === undefined ? [] : variantSteps(actor, rules)),
  ];
}

export function guideFinished(steps: readonly GuideStep[]): boolean {
  return steps.every((step) => step.done || step.optional === true);
}
