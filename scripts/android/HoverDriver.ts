import type { Page } from 'playwright';
import { MODULE_ID } from '../foundry-session.ts';
import type { FoundryToken } from '../foundry-types.ts';

/**
 * Driving the pointer onto a token and reporting what Foundry saw. Extracted from the hover check
 * 2026-08-12.
 */
/** Drive the pointer to a token's centre, in client pixels, and report what Foundry saw. */
export async function hoverToken(page: Page, ids: readonly string[], index: number) {
  return page.evaluate(
    async ({ id, ids, moduleId }) => {
      const token = canvas.tokens.get(id);
      const centre = token.center;

      /*
       * Pan to the token before converting, because a token can be perfectly placed and still be
       * nowhere near the screen. On a 3000px scene at 0.5 zoom the first attempt aimed at client
       * (-769, -584): the maths was right and the token was simply off view, and the pointer
       * clamps at the viewport edge so it never arrived. Panning makes the target reachable
       * instead of merely computable.
       */
      canvas.pan({ x: centre.x, y: centre.y });
      await new Promise((resolve) => {
        setTimeout(resolve, 300);
      });

      const global = canvas.stage.toGlobal({ x: centre.x, y: centre.y });
      const view = canvas.app.view.getBoundingClientRect();
      const client = { clientX: view.x + global.x, clientY: view.y + global.y };

      game.modules.get(moduleId).api.getPointer().moveTo(client);
      await new Promise((resolve) => {
        setTimeout(resolve, 250);
      });

      const tokens: (FoundryToken | undefined)[] = ids.map((other) => canvas.tokens.get(other));
      return {
        client,
        // Cross check the coordinate maths against Foundry's own reading of where the mouse is,
        // so a hover failure can be told apart from a conversion failure.
        mouse: { x: canvas.mousePosition.x, y: canvas.mousePosition.y },
        insideToken:
          canvas.mousePosition.x >= token.document.x &&
          canvas.mousePosition.x <= token.document.x + token.w &&
          canvas.mousePosition.y >= token.document.y &&
          canvas.mousePosition.y <= token.document.y + token.h,
        hovered: tokens.map((other) => other?.hover ?? null),
        nameplates: tokens.map((other) => other?.nameplate?.visible ?? null),
        layerHoverIsThis: canvas.tokens.hover === token,
      };
    },
    { id: ids[index], ids, moduleId: MODULE_ID }
  );
}
