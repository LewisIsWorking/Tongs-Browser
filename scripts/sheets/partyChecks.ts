import type { Page } from 'playwright';

import { pressOutcomeFor, type WorldShape } from './expectations.ts';
import type { Recorder } from '../live/recorder.ts';

/**
 * The party path, which nothing exercised until 2026-09-10. Added the day real PF2e was installed.
 *
 * ⛔ WHY IT WAS NEVER COVERED. `party` is a PF2e actor type, and every live run so far had been
 * against a `coo` world where the count is always zero. The old check hard-coded the no-party
 * notices, so on a real PF2e world it FAILED WHILE THE MODULE WAS RIGHT: PF2e ships a party actor
 * with every new world, so there is a party, so the module correctly offers a list instead of saying
 * there is none.
 *
 * ⚠️ The two branches are decided by `pressOutcomeFor`, a pure function, so which one is right for a
 * given world is provable at a desk. This file only reads the world and does as it is told.
 */
const TRAY_BUTTON = (id: string): string => `[data-action="${id}"]`;

/** Any menu the module has put up, notice or list. */
const MENU = '.tb-choice-menu';
/** ⚠️ The modifier that makes a menu a NOTICE. Its absence is what makes one a real picker. */
const NOTICE = '.tb-choice-menu--notice';

/**
 * What the world holds, plus the party names, which is what proves a picker listed the real thing.
 *
 * ⚠️ `assignable` is every user, because these checks run as a GM and `assignableUsers` returns all
 * of them to a GM. A player-run check would need the player's own count; it is read here rather than
 * assumed so that the day someone runs this as a player, the number is the one that applies.
 */
export async function readWorld(page: Page): Promise<WorldShape & { names: string[] }> {
  return page.evaluate(() => {
    const actors = [...(globalThis.game?.actors ?? [])] as { type?: string; name?: string }[];
    const parties = actors.filter((actor) => actor.type === 'party');
    return {
      parties: parties.length,
      assignable: [...(globalThis.game?.users ?? [])].length,
      names: parties.map((party) => String(party.name ?? '')),
    };
  });
}

async function clearMenus(page: Page): Promise<void> {
  /*
   * ⚠️ `.tb-choice-menu`, NOT the module's data attribute, which the modifier bar also carries. The
   * first version of this in `sheetChecks` deleted the bar and every button on it, then reported
   * that the button it had just found was missing.
   */
  await page.evaluate((selector: string) => {
    document.querySelectorAll(selector).forEach((node) => {
      node.remove();
    });
  }, MENU);
}

/**
 * Press a button and assert what it produced, against what this world says it should.
 *
 * ⛔ IT REFUSES TO PRESS the case that writes. One party and one assignable user collapses every
 * choice to a single answer, so the flow creates an actor on the first tap with nothing shown in
 * between. This harness promises in its own docblock that it writes nothing to the world, and a
 * brand new PF2e world is exactly one party and one user, so the most ordinary world there is would
 * break that promise silently. It is recorded as a SKIP naming the reason, which is a fact worth
 * having rather than a gap: it says the module would create, and that this check chose not to.
 */
export async function checkPress(
  page: Page,
  recorder: Recorder,
  id: 'create-sheet' | 'party-access',
  world: WorldShape & { names: string[] },
  what: string
): Promise<void> {
  const expected = pressOutcomeFor(id, world);
  const ENDING = {
    notice: 'says there is no party',
    picker: 'offers a picker listing the real parties',
    creates: 'would create a sheet with no further prompt',
  } as const;
  const name = `${what} ${ENDING[expected.kind]}`;

  if (expected.kind === 'creates') {
    recorder.skip(name, `not pressed: ${expected.because}, and this check writes nothing`);
    return;
  }

  await clearMenus(page);

  const button = page.locator(TRAY_BUTTON(id)).first();
  if ((await button.count()) === 0) {
    recorder.skip(name, `no ${id} button to press, so nothing could be reached`);
    return;
  }

  await button.click();
  await page.waitForTimeout(400);

  if (expected.kind === 'notice') {
    const text = await page.evaluate(() => document.body.textContent ?? '');
    const found = text.includes(expected.text);
    recorder.record(
      name,
      found,
      found ? `said "${expected.text}"` : `expected "${expected.text}"; page did not contain it`
    );
    return;
  }

  /*
   * ⚠️ A picker is asserted as "a menu that is NOT a notice", because both are the same element with
   * the same class. Counting menus would pass on the notice this branch exists to rule out, which is
   * the exact confusion the two-notice assertion elsewhere was written to catch.
   */
  const shown = await page.evaluate(
    ([menu, notice]) => {
      const node = document.querySelector(String(menu));
      return {
        present: node !== null,
        isNotice: node !== null && node.matches(String(notice)),
        text: node?.textContent ?? '',
      };
    },
    [MENU, NOTICE]
  );

  if (!shown.present) {
    recorder.record(name, false, 'no menu appeared at all');
    return;
  }
  if (shown.isNotice) {
    recorder.record(
      name,
      false,
      `a NOTICE appeared where a picker belongs: "${shown.text.trim()}"`
    );
    return;
  }

  /*
   * ⛔ The picker must list the world's REAL party, not merely be a list. A picker built from an
   * empty array still renders, and "a menu appeared" would pass on it while the feature was dead.
   */
  const listed = world.names.filter(
    (partyName) => partyName !== '' && shown.text.includes(partyName)
  );
  recorder.record(
    name,
    listed.length > 0,
    listed.length > 0
      ? `listed the world's party: ${listed.join(', ')}`
      : `a picker appeared but named none of the world's parties (${world.names.join(', ')})`
  );
}
