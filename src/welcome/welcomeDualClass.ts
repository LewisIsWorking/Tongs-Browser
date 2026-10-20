import { MODULE_ID } from '../constants.js';
import { isBag } from '../dualclass/classFields.js';
import type { ClassChoice } from '../dualclass/DualClassWindow.js';
import type { DualPick } from './ClassPicker.js';

/**
 * The two classes a new player picked in the welcome, kept until their sheet exists. Added 2026-10-20.
 *
 * ⭐ A flag on the player's OWN user, beside the sheet request and naming it (`forRequest`), so it waits as
 *    the request does: through a reload, a closed tab, or a night with no GM. Nothing here builds a class:
 *    `startWelcomeDualClass.ts` turns it into the Dual class window's own request once the sheet is made.
 */
export const WANTED_FLAG = 'welcomeDualClass';

export interface WantedDualClass extends DualPick {
  /** The sheet request it rides with; the sheet made for it carries the same id (`madeForRequest`). */
  readonly forRequest: string;
}

interface WantedUser {
  setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
  unsetFlag?(scope: string, key: string): Promise<unknown>;
}

const text = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** ⚠️ Untrusted, as any flag a player's browser writes. The GM's side checks the classes again anyway. */
export function readWantedDualClass(raw: unknown): WantedDualClass | null {
  if (!isBag(raw)) {
    return null;
  }
  const { forRequest, first, second } = raw;
  return text(forRequest) && text(first) && text(second) ? { forRequest, first, second } : null;
}

/** Written before the sheet request, so the sheet can never exist before its classes are known. */
export async function wantDualClass(
  me: WantedUser | undefined,
  requestId: string,
  pick: DualPick | null
): Promise<unknown> {
  return pick === null
    ? me?.unsetFlag?.(MODULE_ID, WANTED_FLAG)
    : me?.setFlag?.(MODULE_ID, WANTED_FLAG, { forRequest: requestId, ...pick });
}

/**
 * The classes the welcome offers, read once from the compendiums (`dualclass/classChoices.ts`).
 * ⚠️ Undefined while they load, so the welcome waits rather than drawing without them and then never
 *    redrawing (a redraw would wipe a half-typed name). A failed read offers none: one class, as today.
 */
export class ClassOffer {
  private classes: readonly ClassChoice[] | null = null;
  private loading = false;

  public constructor(
    private readonly load: () => Promise<readonly ClassChoice[]>,
    private readonly loaded: () => void
  ) {}

  public get(): readonly ClassChoice[] | undefined {
    if (this.classes === null && !this.loading) {
      this.loading = true;
      void this.load()
        .catch(() => [])
        .then((list) => {
          this.classes = list;
          this.loaded();
        });
    }
    return this.classes ?? undefined;
  }
}
