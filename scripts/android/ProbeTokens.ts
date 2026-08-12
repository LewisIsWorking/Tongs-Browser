import type { Page } from 'playwright';
import { PROBE_PREFIX } from '../foundry-session.ts';
import type { FoundryToken, TokenProbe } from '../foundry-types.ts';

/**
 * Two tokens created in a live world so a hover can be measured, and removed afterwards whatever
 * happens. Extracted from foundry-android-check 2026-08-12.
 */
/**
 * Two probe tokens on the active scene, so hover can be judged and so moving BETWEEN them can be.
 *
 * Returns the ids to delete, or null when the world cannot supply an actor type. Everything created
 * carries PROBE_PREFIX and is removed in the finally, same contract as the probe scene.
 *
 * displayName is set to 30, TOKEN_DISPLAY_MODES.HOVER, deliberately. That is the mode whose
 * nameplate visibility Foundry derives from the hover state, so the nameplate becomes a readable
 * consequence of hovering rather than a decoration that was always on.
 */
export async function createProbeTokens(page: Page): Promise<TokenProbe | null> {
  return page.evaluate(async (prefix: string) => {
    const actorType = game.documentTypes.Actor.find((type: string) => type !== 'base');
    if (actorType === undefined) {
      return null;
    }

    const actor = await Actor.create({ name: `${prefix} hover probe`, type: actorType });
    if (!actor) {
      return null;
    }

    const grid = canvas.scene.grid.size;
    const placements = [
      { x: grid * 3, y: grid * 3 },
      { x: grid * 6, y: grid * 3 },
    ];

    const tokens = await canvas.scene.createEmbeddedDocuments(
      'Token',
      placements.map((at, index) => ({
        name: `${prefix} hover ${String(index)}`,
        actorId: actor.id,
        x: at.x,
        y: at.y,
        width: 1,
        height: 1,
        // TOKEN_DISPLAY_MODES.HOVER, so the nameplate follows hover rather than being always on.
        displayName: 30,
      }))
    );

    /*
     * Wait for the placeables to be DRAWN. createEmbeddedDocuments resolves when the documents
     * exist, which is earlier than when canvas.tokens has objects for them, so reading a baseline
     * straight away reports nameplate visibility as null and the whole check judges nothing.
     */
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const drawn = tokens.every(
        (token: FoundryToken) => canvas.tokens.get(token.id)?.nameplate !== undefined
      );
      if (drawn) {
        break;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    }

    return {
      actorId: actor.id,
      tokenIds: tokens.map((token: FoundryToken) => token.id),
    };
  }, PROBE_PREFIX);
}

export async function removeProbeTokens(page: Page, probe: TokenProbe | null): Promise<void> {
  if (!probe) {
    return;
  }
  await page
    .evaluate(async ({ actorId, tokenIds }) => {
      await canvas.scene.deleteEmbeddedDocuments('Token', tokenIds);
      await game.actors.get(actorId)?.delete();
    }, probe)
    .catch((error) => {
      console.error(`could not remove the probe tokens: ${String(error)}`);
    });
}
