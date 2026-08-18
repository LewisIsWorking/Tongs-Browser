/**
 * Can the pointer play the game ON THE BOARD? Extracted from foundry-play-probe 2026-08-18.
 *
 * Select, open a sheet, open the HUD, drag, zoom, roll. Each has a NATIVE control path beside the
 * pointer path, run only when the pointer path was unreliable, because a control is worth running to
 * explain a failure and not otherwise.
 *
 * Installed rather than imported: see PlayRuntime.ts for why an evaluate callback cannot reach an
 * import, and why these live behind one window namespace instead.
 */
import type { Page } from 'playwright';

import { PLAY_GLOBAL, type PlayWindow } from './PlayRuntime.ts';

export async function installCanvasChecks(page: Page): Promise<void> {
  await page.addInitScript((globalName: string) => {
    const namespace = ((window as PlayWindow)[globalName as '__tongsPlay'] ??= {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    namespace.canvasChecks = async (kit: any) => {
      const { capability, pointerEvent, mouseEvent, requireAt, view, pointer, wait, hover } = kit;

      await capability(
        'select a token',
        async () => {
          pointer.leftClick();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async ({ at }: any) => {
          await hover(at);
          view.dispatchEvent(pointerEvent('pointerdown', at, { button: 0, buttons: 1 }));
          view.dispatchEvent(mouseEvent('mousedown', at, { button: 0, buttons: 1, detail: 1 }));
          view.dispatchEvent(pointerEvent('pointerup', at, { button: 0, buttons: 0 }));
          view.dispatchEvent(mouseEvent('mouseup', at, { button: 0, buttons: 0, detail: 1 }));
          view.dispatchEvent(mouseEvent('click', at, { button: 0, detail: 1 }));
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async ({ token }: any) => token.controlled === true
      );

      await capability(
        'open the character sheet by double click',
        async () => {
          pointer.doubleClick();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async ({ at }: any) => {
          await hover(at);
          for (const detail of [1, 2]) {
            view.dispatchEvent(pointerEvent('pointerdown', at, { button: 0, buttons: 1 }));
            view.dispatchEvent(mouseEvent('mousedown', at, { button: 0, buttons: 1, detail }));
            view.dispatchEvent(pointerEvent('pointerup', at, { button: 0, buttons: 0 }));
            view.dispatchEvent(mouseEvent('mouseup', at, { button: 0, buttons: 0, detail }));
            view.dispatchEvent(mouseEvent('click', at, { button: 0, detail }));
            await wait(60);
          }
          view.dispatchEvent(mouseEvent('dblclick', at, { button: 0, detail: 2 }));
        },
        /*
         * ⚠️ `token.actor`, NOT the actor this trial created, and they are different objects.
         *
         * `Token#_onClickLeft2` renders `this.actor`, and for an UNLINKED token that is a SYNTHETIC
         * delegate with its own sheet instance. Asking the base actor gives `rendered: false` about a
         * sheet that is open on screen. Measured on a live 14.366 (issue #243): `sameActorObject`
         * false, `baseActorSheetRendered` false, `tokenActorSheetRendered` true, and a visible
         * "Diver: [probe] synth" window in the DOM.
         *
         * This reported a working capability as broken for weeks. It is the fourth false negative in
         * this probe's history and the same shape as the other three: the instrument was wrong and
         * the module was fine. `?? actor` keeps a linked token, where the two ARE the same object,
         * working exactly as before.
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async ({ actor, token }: any) => (token?.actor ?? actor).sheet?.rendered === true
      );

      await capability(
        'open the token HUD by right click',
        async () => {
          pointer.rightClick();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async ({ at }: any) => {
          await hover(at);
          view.dispatchEvent(pointerEvent('pointerdown', at, { button: 2, buttons: 2 }));
          view.dispatchEvent(mouseEvent('mousedown', at, { button: 2, buttons: 2, detail: 1 }));
          view.dispatchEvent(pointerEvent('pointerup', at, { button: 2, buttons: 0 }));
          view.dispatchEvent(mouseEvent('mouseup', at, { button: 2, buttons: 0, detail: 1 }));
          view.dispatchEvent(mouseEvent('contextmenu', at, { button: 2, detail: 0 }));
        },
        async () => canvas.hud.token?.rendered === true
      );

      let zoomBefore = 0;
      await capability(
        'zoom with the wheel',
        async () => {
          zoomBefore = canvas.stage.scale.x;
          pointer.wheel(-120);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (context: any) => {
          zoomBefore = canvas.stage.scale.x;
          const wheelAt = requireAt(context.at, 'native wheel');
          view.dispatchEvent(
            new WheelEvent('wheel', {
              clientX: wheelAt.clientX,
              clientY: wheelAt.clientY,
              deltaY: -120,
              bubbles: true,
              cancelable: true,
              composed: true,
              view: window,
            })
          );
        },
        async () => canvas.stage.scale.x !== zoomBefore
      );

      /*
       * Foundry 14's chat box is a <prose-mirror> element, not a <textarea>, so setting .value does
       * nothing at all, silently. Typing has to go through the contenteditable the editor owns.
       */
      let messagesBefore = 0;
      await capability(
        'roll dice from the chat box',
        async () => {
          messagesBefore = game.messages.size;
          const editable = document
            .querySelector('prose-mirror#chat-message')
            ?.querySelector<HTMLElement>('[contenteditable="true"], .ProseMirror');
          if (editable) {
            editable.focus();
            document.execCommand('insertText', false, '/r 1d20');
            await wait(200);
            editable.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                bubbles: true,
                cancelable: true,
              })
            );
          }
        },
        null,
        async () => game.messages.size > messagesBefore,
        false
      );
    };
  }, PLAY_GLOBAL);
}
