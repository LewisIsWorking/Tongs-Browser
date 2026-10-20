import { dualClassOf } from '../dualclass/landDualClass.js';
import type { GuideActor } from './buildGuide.js';
import { gearCount } from './welcomeDocuments.js';
import type { WelcomeActor } from './welcomeDocuments.js';

/**
 * The sheet as the checklist reads it. Moved out of `startWelcome.ts` 2026-10-20, when the variant rules'
 * steps needed the sheet's items too.
 *
 * ⚠️ PF2e Workbench's Ancestry Paragon section is a feat group `xdy_ancestryparagon`; a feat in one of its
 *    slots has `system.location` starting with that id (PF2e names slots `<group>-<level>`). Not measured
 *    live: a wrong guess only leaves the step unticked, and the step is optional.
 */
export const PARAGON_GROUP = 'xdy_ancestryparagon';

export interface GuideSheetItem {
  readonly id: string | null;
  readonly type: string;
  readonly name?: string | null;
  readonly system?: { readonly location?: unknown };
  getFlag?(scope: string, key: string): unknown;
}

export type GuideSheet = WelcomeActor & {
  readonly items?: { readonly contents?: readonly GuideSheetItem[] };
};

export function guideView(actor: GuideSheet): GuideActor {
  const items = actor.items?.contents ?? [];
  const dual = dualClassOf(items);
  /* ⛔ Named one by one, never spread: `ancestry`, `class` and the rest are getters on PF2e's actor
     class, and a spread copies only own properties, so every step would read as not done. */
  return {
    ancestry: actor.ancestry ?? null,
    heritage: actor.heritage ?? null,
    background: actor.background ?? null,
    class: actor.class ?? null,
    ...(actor.system === undefined ? {} : { system: actor.system }),
    gearCount: gearCount(actor),
    dualClass: dual === undefined ? null : (dual.name ?? 'Dual class'),
    paragonFeats: items.filter((item) => {
      const location = item.system?.location;
      return (
        item.type === 'feat' && typeof location === 'string' && location.startsWith(PARAGON_GROUP)
      );
    }).length,
  };
}
