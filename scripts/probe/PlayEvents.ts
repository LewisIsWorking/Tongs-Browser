/**
 * Synthesising the events a native control path dispatches. Extracted from PlayKit 2026-08-18.
 *
 * Separate because it is the half of the toolkit with no Foundry in it: give it a point and a type
 * and it builds a DOM event. That makes it the piece most likely to be wanted on its own, and it kept
 * PlayKit under the limit without anything being trimmed.
 *
 * Installed rather than imported, and composed through the namespace at RUNTIME rather than at import
 * time: `makeKit` calls `makeEvents` off the same window object. See PlayRuntime.ts for why.
 */
import type { Page } from 'playwright';

import { PLAY_GLOBAL, type PlayWindow } from './PlayRuntime.ts';

export async function installPlayEvents(page: Page): Promise<void> {
  await page.addInitScript((globalName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const namespace: any = ((window as PlayWindow)[globalName as '__tongsPlay'] ??= {});

    namespace.makeEvents = () => {
      /*
       * ⚠️ The undefined guard is here, once, rather than at each of the twenty call sites.
       *
       * `at` is absent for the capabilities that need no token, and those paths never dispatch. If one
       * ever did, defaulting to (0, 0) would fire a real event at the top left corner of the window and
       * the trial would report a perfectly ordinary 'no', which is the most expensive kind of wrong
       * answer this probe can give: a capability declared broken because the test aimed at nothing.
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requireAt = (at: any, type: string) => {
        if (at === undefined) {
          throw new Error(
            `a '${type}' was dispatched with no aim point, so the trial aimed nowhere`
          );
        }
        return at;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pointerEvent = (type: string, at: any, extra: PointerEventInit = {}) =>
        new PointerEvent(type, {
          ...requireAt(at, type),
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          view: window,
          ...extra,
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mouseEvent = (type: string, at: any, extra: MouseEventInit = {}) =>
        new MouseEvent(type, {
          ...requireAt(at, type),
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          ...extra,
        });

      return { requireAt, pointerEvent, mouseEvent };
    };
  }, PLAY_GLOBAL);
}
