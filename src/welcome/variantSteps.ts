import type { GuideActor, GuideStep } from './buildGuide.js';
import type { VariantRules } from './variantRules.js';

/**
 * The checklist's steps for this world's variant rules, each only while its rule is on. Added 2026-10-20.
 *
 * 🔔 Terra, 2026-10-20, was sure Ancestry Paragon "added no feats". It doesn't: Ancestry Paragon and Free
 *    Archetype add SLOTS (a section on the Feats tab), and the player fills them. So the words say slots.
 *
 * ⚠️ All three are optional, never holding back "ready": a player may keep one class, and Free Archetype
 *    has nothing to pick until level 2. Ancestry Paragon ticks from the feats in Workbench's section
 *    (`xdy_ancestryparagon`), read in `guideView.ts`.
 */
export const PARAGON_NOTE =
  'You get extra ancestry feat slots, not extra feats: on the Feats tab, drag ancestry feats into the Ancestry Paragon section.';
export const ARCHETYPE_NOTE =
  'You get a free archetype feat slot at level 2 and every even level after: pick an archetype dedication for the Free Archetype section on the Feats tab.';
export const DUAL_NOTE =
  'This world uses the Dual Class rule, so your character can have two classes. Press the button to pick them, or skip this to keep one.';

export function variantSteps(actor: GuideActor, rules: VariantRules): GuideStep[] {
  const steps: GuideStep[] = [];
  if (rules.dualClass) {
    const dual = actor.dualClass ?? null;
    steps.push({
      key: 'dualClass',
      label: 'Pick your dual class',
      done: dual !== null,
      detail: dual,
      optional: true,
      ...(dual === null ? { note: DUAL_NOTE, action: 'dualClass' as const } : {}),
    });
  }
  if (rules.ancestryParagon) {
    const feats = actor.paragonFeats ?? 0;
    steps.push({
      key: 'ancestryParagon',
      label: 'Ancestry Paragon',
      done: feats > 0,
      detail: feats > 0 ? `${String(feats)} ${feats === 1 ? 'feat' : 'feats'}` : null,
      optional: true,
      ...(feats > 0 ? {} : { note: PARAGON_NOTE }),
    });
  }
  if (rules.freeArchetype) {
    steps.push({
      key: 'freeArchetype',
      label: 'Free Archetype',
      done: false,
      detail: 'From level 2',
      optional: true,
      note: ARCHETYPE_NOTE,
    });
  }
  return steps;
}
