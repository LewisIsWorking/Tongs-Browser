import type { Page } from 'playwright';
import { record, skip } from './CheckResults.js';
import { hoverToken } from './HoverDriver.js';
import type { FoundryToken, TokenProbe } from '../foundry-types.ts';

/**
 * Does driving the pointer over a token make Foundry hover it? Extracted from
 * foundry-android-check 2026-08-12.
 */
/**
 * Hover, which is the entire reason this module exists.
 *
 * Position tracking was already proven in ADR 0005: the canvas follows the pointer. That is a
 * strictly weaker claim than this one. A pointer can update `canvas.mousePosition` perfectly while
 * Foundry never runs a single hover transition, and the user would see a cursor gliding over tokens
 * that never light up, never show a nameplate and never open a PF2e HUD panel. Nothing had ever
 * measured the difference.
 *
 * Judged against Foundry's own state, never a CSS class:
 *   - `token.hover`, the getter on PlaceableObject
 *   - `canvas.tokens.hover`, the layer's record of which object is current
 *   - `token.nameplate.visible`, which for displayName 30 Foundry derives from hover
 *
 * ⛔ `highlightObjects` is asserted off first. `_canViewMode(HOVER)` returns
 * `this.hover || this.layer.highlightObjects`, so with highlighting on every nameplate is visible and
 * this check would pass without the pointer having done anything at all.
 */
export async function checkHoverSemantics(page: Page, probe: TokenProbe | null): Promise<void> {
  if (!probe || probe.tokenIds.length < 2) {
    skip('hovering a token makes Foundry hover it', 'the world could not supply two probe tokens');
    return;
  }

  const baseline = await page.evaluate(
    ({ ids }) => {
      const tokens: (FoundryToken | undefined)[] = ids.map((id) => canvas.tokens.get(id));
      return {
        highlightObjects: canvas.tokens.highlightObjects === true,
        hovered: tokens.map((token) => token?.hover ?? null),
        nameplates: tokens.map((token) => token?.nameplate?.visible ?? null),
      };
    },
    { ids: probe.tokenIds }
  );

  /*
   * The two conditions that would make everything below meaningless, and only those.
   *
   * Nameplate visibility is deliberately NOT asserted here, only reported. A freshly drawn token
   * carries visible=true until Foundry's first refresh applies displayName, so a baseline read can
   * legitimately catch it either way. Asserting it produced a failure that said nothing about the
   * module. The nameplate assertion that matters is the TRANSITION, further down.
   */
  record(
    'nothing is highlighting every token, which would make a hover check meaningless',
    baseline.highlightObjects === false && baseline.hovered.every((h) => h === false),
    `highlightObjects=${baseline.highlightObjects}, hover=${JSON.stringify(baseline.hovered)}, nameplates (reported, not asserted)=${JSON.stringify(baseline.nameplates)}`
  );

  const first = await hoverToken(page, probe.tokenIds, 0);

  record(
    'the pointer lands inside the token it is aimed at',
    first.insideToken,
    `moved to client (${Math.round(first.client.clientX)}, ${Math.round(first.client.clientY)}), Foundry read the mouse at scene (${Math.round(first.mouse.x)}, ${Math.round(first.mouse.y)})`
  );

  /*
   * If hover did not happen, find out WHOSE fault it is before reporting anything.
   *
   * The control is a hand built pointermove at the identical coordinates, dispatched straight at the
   * canvas with the module bypassed entirely. If the control produces hover and we did not, the
   * module is at fault and that is a real failure. If the control fails too, this browser cannot
   * produce a hover transition from any scripted pointer event, and blaming the module would be
   * simply wrong.
   *
   * Measured 2026-08-10: desktop Chrome gives hover=true for both, the Chromium 133 emulator gives
   * hover=false for both. Same module, same Foundry, same PIXI 7.4.3. Without this control the check
   * reports a confident, plausible and false module bug.
   */
  if (first.hovered[0] !== true) {
    const control = await page.evaluate(
      async ({ id, at }) => {
        const token = canvas.tokens.get(id);
        canvas.app.view.dispatchEvent(
          new PointerEvent('pointermove', {
            clientX: at.clientX,
            clientY: at.clientY,
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            buttons: 0,
            button: -1,
          })
        );
        await new Promise((resolve) => {
          setTimeout(resolve, 400);
        });
        return { hovered: token?.hover === true };
      },
      { id: probe.tokenIds[0], at: first.client }
    );

    if (!control.hovered) {
      skip(
        'hovering a token makes Foundry hover it',
        'this browser produces no hover from ANY scripted pointer event. A hand built pointermove ' +
          'at the same coordinates, with the module bypassed, also failed to hover, while the same ' +
          'control succeeds on desktop Chrome. The module is not implicated; the environment cannot ' +
          'express the behaviour. Re-run on a device with Chromium 146 or newer.'
      );
      skip('hovering a token shows its nameplate', 'hover itself could not be produced here');
      skip(
        'moving between two tokens updates the hover rather than leaving the first one lit',
        'hover itself could not be produced here'
      );
      return;
    }

    record(
      'hovering a token makes Foundry hover it',
      false,
      `the module's pointer did not hover, but a hand built pointermove at the SAME coordinates did. ` +
        `That points at the module rather than the browser.`
    );
    return;
  }

  record(
    'hovering a token makes Foundry hover it',
    first.hovered[0] === true && first.layerHoverIsThis,
    `token.hover=${String(first.hovered[0])}, canvas.tokens.hover is this token=${String(first.layerHoverIsThis)}`
  );

  record(
    'hovering a token shows its nameplate',
    first.nameplates[0] === true,
    `nameplate.visible went ${String(baseline.nameplates[0])} -> ${String(first.nameplates[0])}`
  );

  const second = await hoverToken(page, probe.tokenIds, 1);

  /*
   * The checklist item that matters most, and the one a single token cannot express: moving between
   * two tokens has to turn the first one OFF. A hover that only ever accumulates leaves a trail of
   * lit tokens behind the cursor, which is worse than no hover at all.
   */
  record(
    'moving between two tokens updates the hover rather than leaving the first one lit',
    second.hovered[1] === true && second.hovered[0] === false,
    `after moving to the second token, hover reads ${JSON.stringify(second.hovered)} and nameplates ${JSON.stringify(second.nameplates)}`
  );
}
