/**
 * Dragging a token to a new square, both ways. Extracted from PlayCanvasChecks 2026-08-18.
 *
 * Split out when adding the `hover` step to the native control paths took PlayCanvasChecks to 214
 * lines. The drag is the natural piece to move: it is the only capability whose control path is a
 * whole gesture rather than a single burst, and it is the one the module exists for.
 *
 * Installed rather than imported: see PlayRuntime.ts for why an evaluate callback cannot reach an
 * import.
 */
import type { Page } from 'playwright';

import { PLAY_GLOBAL, type PlayWindow } from './PlayRuntime.ts';

export async function installDragCheck(page: Page): Promise<void> {
  await page.addInitScript((globalName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const namespace: any = ((window as PlayWindow)[globalName as '__tongsPlay'] ??= {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    namespace.dragCheck = async (kit: any) => {
      const { capability, pointerEvent, mouseEvent, requireAt, view, pointer, wait, home, hover } =
        kit;

      await capability(
        'drag a token to a new square',
        async () => {
          pointer.beginDrag();
          for (let step = 0; step < 10; step += 1) {
            pointer.dragBy(15, 0);
            await wait(50);
          }
          pointer.endDrag();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (context: any) => {
          const at = requireAt(context.at, 'native drag');
          await hover(at);
          view.dispatchEvent(pointerEvent('pointerdown', at, { button: 0, buttons: 1 }));
          view.dispatchEvent(mouseEvent('mousedown', at, { button: 0, buttons: 1 }));
          for (let step = 1; step <= 10; step += 1) {
            const to = { clientX: at.clientX + step * 15, clientY: at.clientY };
            view.dispatchEvent(pointerEvent('pointermove', to, { buttons: 1 }));
            view.dispatchEvent(mouseEvent('mousemove', to, { buttons: 1 }));
            await wait(50);
          }
          const end = { clientX: at.clientX + 150, clientY: at.clientY };
          view.dispatchEvent(pointerEvent('pointerup', end, { button: 0, buttons: 0 }));
          view.dispatchEvent(mouseEvent('mouseup', end, { button: 0, buttons: 0 }));
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async ({ doc }: any) => canvas.scene.tokens.get(doc.id).x !== home.x
      );
    };
  }, PLAY_GLOBAL);
}
