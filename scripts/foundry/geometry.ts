import type { Page } from 'playwright';

/**
 * Where Foundry's canvas is, in the coordinates every gesture driver here speaks. Extracted from
 * foundry-session 2026-08-12.
 *
 * Extracted because that file reached 398 lines against a hard 200 limit, and because these are the
 * only functions in it that answer a question about the PAGE rather than perform a step of a
 * session. Every touch, pointer and drag harness starts by asking where the board is.
 */

/** A point in client coordinates, which is what every touch and pointer driver here speaks. */
export interface ClientPoint {
  readonly x: number;
  readonly y: number;
}

/** Foundry's canvas element, in client coordinates. */
export interface BoardBox extends ClientPoint {
  readonly width: number;
  readonly height: number;
}

/**
 * Where Foundry's canvas is on screen.
 *
 * ⚠️ THROWS rather than returning a default when `#board` is absent, and the difference is the whole
 * reason this exists. Every caller uses the result as the origin of a gesture, so a fallback of
 * (0, 0) would press the top left corner of the window: a real press, on the wrong element, that
 * produces a plausible looking FAIL for whichever behaviour was under test. The check would then be
 * blaming the module for a world that never finished loading its canvas.
 *
 * Extracted 2026-08-12 from four scripts that each repeated the query, two of which were reading
 * `getBoundingClientRect` straight off a possibly null result.
 */
export async function boardBox(page: Page): Promise<BoardBox> {
  return page.evaluate(() => {
    const board = document.querySelector('#board');
    if (board === null) {
      throw new Error(
        'No #board in the page, so Foundry has no canvas to press. The world is probably still ' +
          'loading, or the join never completed.'
      );
    }
    const box = board.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
}

/** The middle of the canvas, which is where a gesture with no particular target belongs. */
export async function boardCentre(page: Page): Promise<ClientPoint> {
  const box = await boardBox(page);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
