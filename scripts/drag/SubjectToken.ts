import type { Page } from 'playwright';

import type { CdpPage } from '../cdp-page.ts';
import { evaluateOn } from './EvaluateOn.ts';
import { createProbeToken } from './ProbeToken.ts';

/**
 * Getting a token to drag: created on desktop, ADOPTED on a device. Extracted from
 * foundry-drag-check 2026-08-13.
 *
 * ⚠️ Creating a probe actor and token is four document writes, and every write to a phone is a
 * Foundry socket round trip that has been measured in MINUTES over wireless adb. Two runs died that
 * way having produced no output at all, and both left probe entities behind in a live world for
 * someone else to clean up.
 *
 * None of it is needed there. The check needs a token it may move, and the world already has one the
 * user has selected: that is what they were dragging when they hit the bug, which makes it a better
 * subject than anything this could invent. The position is restored afterwards, so the only write is
 * the drag itself, which is the thing under test.
 */
export interface Subject {
  /** Set when a token was created and must be deleted afterwards. */
  readonly created: { actorId: string; tokenId: string } | null;
  /** Set when an existing token was borrowed and must be put back where it was. */
  readonly restore: { name: string; x: number; y: number } | null;
}

export async function takeSubjectToken(page: Page | CdpPage, onDevice: boolean): Promise<Subject> {
  if (!onDevice) {
    return { created: await createProbeToken(page), restore: null };
  }

  const adopted = await evaluateOn(page, () => {
    const token = canvas.tokens.controlled[0] ?? canvas.tokens.placeables[0];
    if (token === undefined) {
      return null;
    }
    token.control({ releaseOthers: true });
    return { name: token.name, x: token.document.x, y: token.document.y };
  });

  if (adopted === null) {
    throw new Error('the scene on the device has no token to drag. Put one on the map first.');
  }

  console.log(
    `Adopted the existing token '${String(adopted.name)}' at (${String(adopted.x)}, ` +
      `${String(adopted.y)}). Nothing is created and its position is restored afterwards.`
  );
  return { created: null, restore: adopted };
}
