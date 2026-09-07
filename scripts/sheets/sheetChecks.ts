import type { Page } from 'playwright';

import { expectationFor } from './expectations.ts';
import type { Recorder } from '../live/recorder.ts';

/**
 * What the sheet-creation buttons do in a real Foundry. Added 2026-09-03.
 *
 * ⚠️ These are the failures a green build CANNOT catch, which is the only reason to run a browser at
 * all. Every one of them compiles, type-checks and passes 1414 unit tests:
 *
 * - a button registered in the tray list but filtered out by a gate that reads a global wrongly
 * - a picker appended to a host that does not exist on a real page
 * - a flow that throws inside a click handler, where the error goes to a console nobody reads
 * - a notice whose text is right in the fixture and never reaches the DOM
 *
 * ⚠️ This does NOT exercise the party path, and says so rather than pretending. A `party` actor type
 * exists only in PF2e and its derivatives; the world available here runs `coo`, so there is nothing to
 * open and nothing to create in. What that leaves is still worth having: it proves the buttons exist,
 * are reachable, and say the RIGHT thing when there are no parties, which is exactly the state a real
 * user hits first.
 */
/**
 * ⚠️ ONE selector, matching what `ModifierBar` actually writes, and not a list of plausible ones. An
 * alternative in here would survive a rename of the attribute and go on "passing" while testing
 * nothing, which is the failure this whole file exists to catch in the module.
 */
const TRAY_BUTTON = (id: string): string => `[data-action="${id}"]`;

async function trayButtonExists(page: Page, id: string): Promise<boolean> {
  return page.evaluate(
    (selector: string) => document.querySelector(selector) !== null,
    TRAY_BUTTON(id)
  );
}

/**
 * Who this session actually is, and what the world holds. Added 2026-09-07.
 *
 * ⚠️ READ rather than assumed, and that is the fix for a real defect. These checks were written
 * against `FOUNDRY_USER=Gamemaster`, the default, and named their assertions "for a GM" while never
 * establishing that they were one. Run as a player they reported the create and party buttons
 * MISSING, which is the module's gate working exactly as designed, as two module failures.
 *
 * ⛔ That is the harness accusing the feature, which is the one thing a check must never do. It is
 * worse than no check at all: it produces a red result pointing at innocent code, and the next
 * person spends their afternoon in the module.
 */
async function readViewer(page: Page): Promise<{ isGm: boolean; parties: number }> {
  return page.evaluate(() => ({
    isGm: globalThis.game?.user?.isGM === true,
    parties: [...(globalThis.game?.actors ?? [])].filter(
      (actor: { type?: string }) => actor.type === 'party'
    ).length,
  }));
}

/**
 * The tray has to be showing before anything on it can be asserted.
 *
 * ⚠️ The EXPECTATION depends on who is looking, and saying so is the point:
 *
 *   - a GM sees both buttons, always;
 *   - a player never sees party access, which is GM only and stays that way;
 *   - a player sees create only where a GM has opened a party to them, so in a world with no parties
 *     at all its absence is the gate working and its PRESENCE would be the bug.
 *
 * ⚠️ A player in a world that DOES hold parties cannot be judged from out here: whether one is open
 * to them is exactly the decision under test, and asserting either way would be asserting the
 * module's own answer back at it. That case skips, and says why.
 */
export async function checkButtonsPresent(page: Page, recorder: Recorder): Promise<void> {
  const viewer = await readViewer(page);

  for (const [id, what] of [
    ['create-sheet', 'the create button'],
    ['party-access', 'the party access button'],
  ] as const) {
    const present = await trayButtonExists(page, id);
    const found = present ? `found ${id}` : `no element matching ${TRAY_BUTTON(id)}`;
    const expected = expectationFor(id, what, viewer);

    if (expected.kind === 'skip') {
      recorder.skip(expected.name, expected.because);
    } else if (expected.kind === 'present') {
      recorder.record(expected.name, present, found);
    } else {
      recorder.record(expected.name, !present, `${expected.because}: ${found}`);
    }
  }
}

/**
 * ⚠️ Asserts the TEXT, not merely that something appeared. "A picker opened" is satisfied by an empty
 * box; the whole value of these two notices is that they say different things, and a wiring mistake
 * that showed `noParties` where `notAllowed` belongs would look identical to a check that only
 * counted elements.
 */
export async function checkNoticeText(
  page: Page,
  recorder: Recorder,
  id: string,
  expected: string,
  name: string
): Promise<void> {
  /*
   * ⚠️ `.tb-choice-menu`, NOT `[data-tongs-browser="ignore"]`. The first version cleared by the
   * attribute, which the modifier bar ALSO carries, so it deleted the bar and every button on it. The
   * run then reported "no create-sheet button to press" one line after finding it.
   *
   * That contradiction was only visible because the harness SKIPPED rather than failing: a boolean
   * would have read as the module having lost its own button, and the bug would have been hunted in
   * the wrong repository.
   */
  await page.evaluate(() => {
    document.querySelectorAll('.tb-choice-menu').forEach((node) => {
      node.remove();
    });
  });

  const button = page.locator(TRAY_BUTTON(id)).first();
  if ((await button.count()) === 0) {
    recorder.skip(name, `no ${id} button to press, so the notice could not be reached`);
    return;
  }

  await button.click();
  await page.waitForTimeout(300);

  const text = await page.evaluate(() => document.body.textContent ?? '');
  const found = text.includes(expected);
  recorder.record(
    name,
    found,
    found ? `said "${expected}"` : `expected "${expected}"; page did not contain it`
  );
}

/**
 * ⚠️ A console error DURING the interaction, not since page load. Foundry and other modules log their
 * own problems constantly, so "the console is clean" is never true and asserting it would make this
 * check fail for reasons that have nothing to do with the module. Only errors naming this module
 * count, and only ones raised while its buttons were being pressed.
 */
export function watchModuleErrors(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(String(error.message));
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Tongs Browser')) {
      errors.push(message.text());
    }
  });
  return { errors };
}
