import type { Page } from 'playwright';

import type { CdpPage } from '../cdp-page.ts';
import { evaluateOn } from './EvaluateOn.ts';
import { removeProbeToken } from './ProbeToken.ts';
import type { Subject } from './SubjectToken.ts';

/**
 * Putting back whatever the check borrowed. Extracted from foundry-drag-check 2026-08-13.
 *
 * ⚠️ This runs against somebody's LIVE GAME, not a fixture. The drag is allowed to move a borrowed
 * token; the check is not allowed to leave it moved, and it is not allowed to leave a probe actor
 * behind either. Two earlier runs died mid check over wireless adb and did exactly that.
 *
 * ⚠️ Every failure here is REPORTED AND SWALLOWED. A cleanup that throws replaces the verdict of the
 * check with the story of its own tidying up, and the verdict is the thing the run exists to
 * produce. A failed tidy is worth knowing about; it is not worth losing the answer over.
 *
 * Deliberately covers the TOKEN only. Tearing down the scene and deciding whether to close a browser
 * belong to the run that opened them, and on a device that browser is the user's own Chrome.
 */
export async function putTheTokenBack(page: Page | CdpPage, subject: Subject): Promise<void> {
  if (subject.restore !== null) {
    // Captured into a const so the arrow callback below keeps the narrowing. A closure over the
    // mutable binding would not.
    const putBack = subject.restore;
    await evaluateOn(
      page,
      async (at: { name: string; x: number; y: number }) => {
        const token = canvas.tokens.controlled[0] ?? canvas.tokens.placeables[0];
        await token?.document.update({ x: at.x, y: at.y });
      },
      putBack
    ).catch((error: Error) => {
      console.error(
        `could not put '${putBack.name}' back at (${String(putBack.x)}, ` +
          `${String(putBack.y)}): ${String(error)}`
      );
    });
  }

  if (subject.created !== null) {
    await removeProbeToken(page, subject.created).catch((error: Error) => {
      console.error(`could not remove the probe token: ${String(error)}`);
    });
  }
}
