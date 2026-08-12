import type { Page } from 'playwright';

/**
 * Making sure a live world has a scene to press on, and putting it back afterwards. Extracted from
 * foundry-session 2026-08-12.
 *
 * ⚠️ These WRITE to a live world, which is why they are together and separately named. Everything
 * created is prefixed, so a crash that skips the cleanup leaves something identifiable in the
 * user's own game rather than a mystery scene they have to work out the origin of.
 */

/**
 * Anything this creates in a live world is named with this prefix, so a crash that skips the cleanup
 * leaves something identifiable rather than a mystery scene.
 */
export const PROBE_PREFIX = '[probe]';

/**
 * Create a scene only if the world has no active one, and say which happened by returning the id to
 * delete or null. Extracted 2026-08-10 when the Android check became the second caller.
 *
 * The dimensions are a parameter and not a constant on purpose. The scene must be larger than the
 * viewport it will be judged in, because a scene that fits on screen loads at scale 1, and 1 is the
 * one value that hides an entire class of zoom bug: multiplying by it is indistinguishable from
 * ignoring it. That is why the pinch check asks for 4000 and why a phone viewport can be satisfied
 * by less. Callers that do not care get a size that is larger than a desktop window.
 */
export async function ensureActiveScene(
  page: Page,
  { width = 2000, height = 2000, label = 'canvas check' } = {}
) {
  const existing = await page.evaluate(() => globalThis.canvas?.ready === true);
  if (existing) {
    return null;
  }

  const id = await page.evaluate(
    async ({
      prefix,
      sceneWidth,
      sceneHeight,
      name,
    }: {
      prefix: string;
      sceneWidth: number;
      sceneHeight: number;
      name: string;
    }) => {
      const scene = await Scene.create({
        name: `${prefix} Tongs Browser ${name}`,
        width: sceneWidth,
        height: sceneHeight,
        grid: { size: 100 },
        padding: 0.25,
      });
      await scene.activate();
      return scene.id;
    },
    { prefix: PROBE_PREFIX, sceneWidth: width, sceneHeight: height, name: label }
  );

  await page.waitForFunction(() => globalThis.canvas?.ready === true, undefined, {
    timeout: 120_000,
  });

  return id;
}

/** Remove a scene created by ensureActiveScene. Safe to call with null. */
export async function removeProbeScene(page: Page, id: string | null): Promise<void> {
  if (id === null || id === undefined) {
    return;
  }
  await page
    .evaluate(async (sceneId) => {
      await game.scenes.get(sceneId)?.delete();
    }, id)
    .catch((error) => {
      console.error(`could not delete the probe scene ${id}: ${String(error)}`);
    });
}
