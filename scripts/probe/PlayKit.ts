/**
 * The shared machinery every capability trial needs. Extracted from foundry-play-probe 2026-08-18.
 *
 * Installed into the page rather than imported, for the reason PlayRuntime.ts gives: an evaluate
 * callback is serialised and cannot reach an import. See that file before changing anything here.
 *
 * Every rule encoded below replaced a probe that reported confident capability gaps which did not
 * exist. They are preserved verbatim from the original single file:
 *
 *   1. The control runs from the same freshly built state as the subject, never from the wreckage
 *      the subject's failure left behind. A control that runs second is a sequel, not a control.
 *   2. Every path runs three times, because a capability that works once and not again is FLAKY,
 *      which is its own finding.
 *   3. Every trial builds its own actor and token and deletes them again. A probe that reuses a
 *      fixture across cases measures history, not behaviour.
 *   4. The aim is asserted as its own precondition, so "the feature is broken" and "the feature was
 *      never reached" stay different findings.
 *
 * Event synthesis lives in PlayEvents.ts and is composed in through the namespace at runtime.
 */
import type { Page } from 'playwright';

import { PLAY_GLOBAL, type PlayWindow } from './PlayRuntime.ts';

export async function installPlayKit(page: Page): Promise<void> {
  await page.addInitScript((globalName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const namespace: any = ((window as PlayWindow)[globalName as '__tongsPlay'] ??= {});

    namespace.makeKit = (trials: number, forceControl = false) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = [];
      const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
      const pointer = game.modules.get('tongs-browser').api.getPointer();
      const view = canvas.app.view;
      const grid = canvas.scene.grid.size;
      const home = { x: grid * 3, y: grid * 3 };

      /** A brand new actor and token per trial, from PlayFixture.ts. */
      const { withFixture } = namespace.makeFixture(wait, home);

      /** Pan, wait for the transform, convert, move, and REPORT whether the aim actually landed. */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async function aim(token: any) {
        canvas.pan({ x: token.center.x, y: token.center.y });
        await wait(400);
        const global = canvas.stage.toGlobal({ x: token.center.x, y: token.center.y });
        const box = view.getBoundingClientRect();
        const at = { clientX: box.x + global.x, clientY: box.y + global.y };
        pointer.moveTo(at);
        await wait(250);
        const mouse = canvas.mousePosition;
        const landed =
          mouse.x >= token.document.x &&
          mouse.x <= token.document.x + token.w &&
          mouse.y >= token.document.y &&
          mouse.y <= token.document.y + token.h;
        return { at, landed };
      }

      /**
       * Aim the pointer at a DOM element's centre and report whether it actually got there.
       *
       * Same precondition discipline as the canvas aim: a click that missed is a different finding
       * from a click that was ignored.
       */
      async function aimAtElement(element: Element | null | undefined) {
        if (!element) {
          return { at: null, landed: false, topmost: 'the element does not exist' };
        }
        if (element.getClientRects().length === 0) {
          return { at: null, landed: false, topmost: 'the element has no layout box' };
        }
        const box = element.getBoundingClientRect();
        const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
        pointer.moveTo(at);
        await wait(250);
        const top = document.elementFromPoint(at.clientX, at.clientY);
        return {
          at,
          landed: element === top || element.contains(top) || (top?.contains(element) ?? false),
          topmost: top
            ? `${top.tagName.toLowerCase()}.${String(top.className).slice(0, 40)}`
            : 'nothing',
        };
      }

      /**
       * Put a sidebar tab on screen, and say whether it worked.
       *
       * ⚠️ EXPANDING IS THE POINT, not changing tab. Measured against a live 14.366 on 2026-08-18:
       * `ui.sidebar.expanded` is false after `game.ready` and stays false through `changeTab`, and a
       * collapsed sidebar lays its tab content out with its centre off screen. So every sidebar
       * button is present in the DOM, has a layout box, and cannot be pressed.
       *
       * ⚠️ Polls for the outcome rather than sleeping. The old fixed 700ms wait was measured to be
       * irrelevant - the button never became reachable at any delay up to three seconds - but a sleep
       * would have hidden the cause behind a plausible timing story, and the next person would have
       * raised the number instead of opening the sidebar.
       */
      async function openTab(name: string): Promise<boolean> {
        await ui.sidebar.changeTab(name, 'primary');
        await ui.sidebar.expand?.();
        for (let attempt = 0; attempt < 30; attempt += 1) {
          if (ui.sidebar.expanded === true) return true;
          await wait(100);
        }
        return ui.sidebar.expanded === true;
      }

      /**
       * Run one path `trials` times, each in its own fixture. Outcomes are 'yes', 'no', or 'AIM' when
       * the precondition failed and the trial therefore says nothing about the behaviour.
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async function run(path: any, read: any, needsToken = true) {
        const outcomes = [];
        for (let trial = 0; trial < trials; trial += 1) {
          if (!needsToken) {
            await path({});
            await wait(900);
            outcomes.push((await read({})) ? 'yes' : 'no');
            continue;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const outcome = await withFixture(async (fixture: any) => {
            const aimed = await aim(fixture.token);
            if (!aimed.landed) return 'AIM';
            await path({ ...fixture, at: aimed.at });
            await wait(900);
            return (await read(fixture)) ? 'yes' : 'no';
          });
          outcomes.push(outcome);
        }
        return outcomes;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reliable = (outcomes: any[]) => outcomes.every((outcome) => outcome === 'yes');

      /**
       * Both paths, with the control run only to explain a failure.
       *
       * ⚠️ `forceControl` exists because a control that only runs on failure is a control NOBODY EVER
       * SEES WORK. Every pointer path passes today, so the controls had not executed in months, and
       * when one was finally exercised by hand it could not even select a token: it pressed with
       * Foundry's interaction manager still at NONE, because it never moved the pointer first.
       *
       * That is the worst possible state for this particular piece of code. The control is what
       * decides whether a pointer failure reads as "the module is broken" or "cannot tell", so a
       * broken control turns every real regression into `inconclusive`. The safety net had a hole in
       * exactly the place it would be needed, and nothing could have noticed.
       *
       * `PROBE_FORCE_CONTROL=1` runs both paths every time, so the control is observable on demand
       * rather than only in the moment it is being relied upon.
       */
      async function capability(
        name: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viaPointer: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viaNative: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        read: any,
        needsToken = true
      ) {
        const pointerTrials = await run(viaPointer, read, needsToken);
        let controlTrials = null;
        if ((forceControl || !reliable(pointerTrials)) && viaNative !== null) {
          controlTrials = await run(viaNative, read, needsToken);
        }
        results.push({ name, pointerTrials, controlTrials });
      }

      return {
        trials,
        results,
        home,
        wait,
        pointer,
        view,
        withFixture,
        aim,
        aimAtElement,
        openTab,
        run,
        capability,
        ...namespace.makeEvents(view, wait),
      };
    };
  }, PLAY_GLOBAL);
}
