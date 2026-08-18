/**
 * Creating an actor from the sidebar, entirely through the pointer.
 * Extracted from foundry-play-probe 2026-08-18, carrying its own bug fix.
 *
 * ⚠️ THE SIDEBAR IS COLLAPSED AND changeTab DOES NOT OPEN IT. Measured against a live 14.366 on
 * 2026-08-18, after this capability reported AIM with "create button blocked by the element does not
 * exist". The button exists and carries `data-action="createEntry"` exactly as before; what it lacks
 * is a centre inside the viewport, because a collapsed sidebar lays its tab content out off screen.
 *
 * Measured both ways rather than assumed, because a touch surface was the obvious suspect and was
 * wrong: with `hasTouch` false AND true, the button is unreachable after `changeTab` and reachable
 * after `expand()`. So it is the collapse, and opening the drawer is a step a human takes too rather
 * than a harness workaround. The expansion now lives in the kit's `openTab`.
 *
 * The old code had anticipated the SHAPE of this ("a button that has a layout box can still sit
 * outside the viewport"), which is why it reported AIM rather than a false 'no'. The probe was right
 * to refuse the question. It just never opened the drawer.
 */
import type { Page } from 'playwright';

import { PLAY_GLOBAL, type PlayWindow } from './PlayRuntime.ts';

export async function installCreateActorCheck(page: Page): Promise<void> {
  await page.addInitScript((globalName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const namespace: any = ((window as PlayWindow)[globalName as '__tongsPlay'] ??= {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    namespace.createActorCheck = async (kit: any) => {
      const { trials, results, wait, pointer, aimAtElement, openTab } = kit;
      const outcomes = [];
      const madeNames = [];
      let blockedBy = '';

      for (let trial = 0; trial < trials; trial += 1) {
        const name = `[probe] made ${String(trial)}`;
        const opened = await openTab('actors');
        await wait(400);

        /*
         * Foundry renders a create button per sidebar tab and hides the ones not showing, so the
         * button has to be chosen by being genuinely on screen, not by being the first match.
         * Picking the first clicks "Create Scene" while reporting on actors, and a button that has a
         * layout box can still sit outside the viewport, which makes elementFromPoint return null
         * and reads as "blocked by nothing".
         */
        const createButton = [
          ...document.querySelectorAll('button[data-action="createEntry"]'),
        ].find((button) => {
          const box = button.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return false;
          // The CENTRE has to be on screen, not the whole box. A sidebar button flush against the
          // right edge can overhang by a pixel and still be perfectly clickable.
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          return cx >= 0 && cy >= 0 && cx <= window.innerWidth && cy <= window.innerHeight;
        });

        const aimed = await aimAtElement(createButton);
        if (!aimed.landed) {
          /*
           * ⚠️ Name the SIDEBAR STATE, not just the obstruction. "the element does not exist" about a
           * button plainly present in the DOM is what sent a reader hunting for a renamed selector.
           * Saying whether the drawer was open turns the same failure into its own diagnosis.
           */
          blockedBy =
            `create button blocked by ${aimed.topmost} ` +
            `(sidebar expanded: ${String(ui.sidebar.expanded)}, openTab reported ${String(opened)})`;
          outcomes.push('AIM');
          continue;
        }
        pointer.leftClick();
        await wait(1200);

        const dialog = [...document.querySelectorAll('.application')].find(
          (element) => element.querySelector('input[name="name"]') !== null
        );
        if (!dialog) {
          outcomes.push('no');
          continue;
        }

        /*
         * The dialog was FOUND by having this input, so a null here is not really reachable. Guarded
         * anyway and reported as 'no' rather than left to throw, because an exception inside the page
         * aborts the whole probe and loses every trial that had already been measured.
         */
        const nameInput = dialog.querySelector<HTMLInputElement>('input[name="name"]');
        if (nameInput === null) {
          outcomes.push('no');
          continue;
        }
        nameInput.value = name;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        nameInput.dispatchEvent(new Event('change', { bubbles: true }));

        const submit = dialog.querySelector('button[type="submit"], button[data-action="ok"]');
        const submitAimed = await aimAtElement(submit);
        if (!submitAimed.landed) {
          blockedBy = `create dialog submit blocked by ${submitAimed.topmost}`;
          outcomes.push('AIM');
          continue;
        }
        pointer.leftClick();
        await wait(1800);

        const made = game.actors.getName(name);
        outcomes.push(made ? 'yes' : 'no');
        if (made) {
          madeNames.push(name);
          if (made.sheet?.rendered) await made.sheet.close();
          await made.delete().catch(() => undefined);
        }
        await wait(300);
      }

      results.push({
        name: 'create an actor from the sidebar',
        pointerTrials: outcomes,
        controlTrials: null,
        note:
          `created ${String(madeNames.length)} actor(s) end to end through the pointer` +
          (blockedBy === '' ? '' : `; ${blockedBy}`),
      });
    };
  }, PLAY_GLOBAL);
}
