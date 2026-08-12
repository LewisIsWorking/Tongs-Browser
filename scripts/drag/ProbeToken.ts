import type { Page } from 'playwright';
import { PROBE_PREFIX } from '../foundry-session.ts';
import type { CdpPage } from '../cdp-page.ts';
import { evaluateOn } from './EvaluateOn.ts';

/**
 * A token to drag, created and removed in a live world. Extracted from foundry-drag-check
 * 2026-08-12.
 */
/**
 * A token to drag, and an actor to hang it on.
 *
 * The actor type is read from the system rather than hardcoded, because this world runs `coo` and
 * the next one will not. Hardcoding "character" would make the check fail on a system that spells it
 * differently, and that failure would accuse the drag.
 */
export async function createProbeToken(page: Page | CdpPage) {
  return evaluateOn(
    page,
    async (prefix) => {
      /*
       * Two shapes, both real. `game.documentTypes.Actor` is an array of names; the same key on
       * `game.system.documentTypes` is an object keyed by name whose values carry the type's metadata.
       * Reading only one of them threw `.filter is not a function` on this world, which is a confusing
       * way to be told the schema is not what you assumed.
       */
      const declared = game.documentTypes?.Actor ?? game.system.documentTypes?.Actor ?? [];
      const names = Array.isArray(declared) ? declared : Object.keys(declared);
      const type = names.filter((name) => name !== 'base')[0];
      if (type === undefined) {
        throw new Error('this system declares no Actor types, so no token can be made.');
      }

      const actor = await Actor.create({ name: `${prefix} drag subject`, type });

      // Placed well inside the scene, so a 240px drag in any direction stays on the canvas. A token
      // dragged off the scene is refused, and the refusal looks exactly like the bug being hunted.
      const [document] = await canvas.scene.createEmbeddedDocuments('Token', [
        { name: `${prefix} drag subject`, actorId: actor.id, x: 600, y: 600, width: 1, height: 1 },
      ]);

      return { actorId: actor.id, tokenId: document.id };
    },
    PROBE_PREFIX
  );
}

export async function removeProbeToken(
  page: Page | CdpPage,
  { actorId, tokenId }: { actorId: string; tokenId: string }
) {
  await evaluateOn(
    page,
    async ({ actor, token }) => {
      await canvas.scene?.deleteEmbeddedDocuments('Token', [token]).catch(() => undefined);
      await game.actors.get(actor)?.delete();
    },
    { actor: actorId, token: tokenId }
  );
}
