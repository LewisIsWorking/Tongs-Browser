import type { Page } from 'playwright';
import { ensureActiveScene } from '../foundry-session.ts';
import { Finger } from '../foundry-touch.ts';
import { checkHoverSemantics } from './CheckHover.js';
import { checkTapClicksAtPointer } from './CheckTap.js';
import { createProbeTokens } from './ProbeTokens.js';
import { describeError, record, skip } from './CheckResults.js';
import type { TokenProbe } from '../foundry-types.ts';

/**
 * The checks that need a canvas, with the scene and tokens they create. Extracted from
 * foundry-android-check 2026-08-12.
 *
 * ⚠️ Everything created here is removed in the finally, tokens BEFORE the scene: deleting the scene
 * first orphans the token delete, and a `[probe]` actor left in somebody's real world reads as a
 * mysterious NPC rather than as harness debris.
 */
/** What was created in the live world, so the caller can remove it whatever happens. */
export interface CanvasDebris {
  readonly scene: string | null;
  readonly tokens: TokenProbe | null;
}

export async function runCanvasChecks(page: Page): Promise<CanvasDebris> {
  // The scene is bigger than the phone viewport on purpose.
  let canvasReady = false;
  let createdScene: string | null = null;
  let probeTokens: TokenProbe | null = null;
  try {
    createdScene = await ensureActiveScene(page, {
      width: 3000,
      height: 3000,
      label: 'android check',
    });
    canvasReady = await page.evaluate(() => globalThis.canvas?.ready === true);
  } catch (error) {
    skip('the canvas becomes ready on Android', describeError(error));
  }

  if (canvasReady) {
    record(
      'the canvas becomes ready on Android',
      true,
      `scale ${await page.evaluate(() => canvas.stage.scale.x.toFixed(3))}`
    );
    const client = await page.context().newCDPSession(page);
    await checkTapClicksAtPointer(page, new Finger(client));

    probeTokens = await createProbeTokens(page);
    await checkHoverSemantics(page, probeTokens);
  } else {
    skip('tap clicks at the pointer rather than under the finger', 'the canvas never became ready');
    skip('hovering a token makes Foundry hover it', 'the canvas never became ready');
  }

  return { scene: createdScene, tokens: probeTokens };
}
