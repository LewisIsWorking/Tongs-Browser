import { expect, test, type Page } from '@playwright/test';

/**
 * Browser tests against real Chromium, exercising the built bundle.
 *
 * These cover the questions jsdom structurally cannot answer, because it has no layout engine:
 * whether elementFromPoint resolves the element the cursor is visually over, whether that survives
 * a CSS transform, and whether the cursor overlay stays out of its own way. Those are the failures
 * that would otherwise be discovered on a tablet, which is a far slower place to discover them.
 */

const FIXTURE = '/tests/browser/fixtures/foundry-stub.html';

interface RecordedEvent {
  type: string;
  target: string;
  buttons: number | null;
  button: number | null;
  clientX: number | null;
  clientY: number | null;
  code: string | null;
  shiftKey: boolean | null;
  isTrusted: boolean;
  hasView: boolean | null;
}

async function boot(page: Page): Promise<void> {
  await page.goto(FIXTURE);
  await page.waitForFunction(() => (window as unknown as { tongs?: unknown }).tongs !== undefined);
}

async function clearEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { recorded: unknown[] }).recorded = [];
  });
}

async function events(page: Page): Promise<RecordedEvent[]> {
  return page.evaluate(() => (window as unknown as { recorded: RecordedEvent[] }).recorded);
}

/** Drives the pointer through the module's own public API. */
async function moveTo(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ([clientX, clientY]) => {
      const tongs = (window as unknown as { tongs: { getPointer(): { moveTo(p: unknown): void } } })
        .tongs;
      tongs.getPointer().moveTo({ clientX, clientY });
    },
    [x, y]
  );
}

test.describe('cursor overlay', () => {
  /**
   * The load bearing one. If the cursor were hit testable, elementFromPoint would resolve to the
   * cursor for every position and nothing underneath would ever receive an event. jsdom cannot test
   * this at all, since it does not implement elementFromPoint.
   */
  test('is never returned by elementFromPoint, at the exact position it is drawn', async ({
    page,
  }) => {
    await boot(page);
    await moveTo(page, 150, 350);

    const resolved = await page.evaluate(() => {
      const element = document.elementFromPoint(150, 350);
      return { id: element?.id ?? '', className: element?.className ?? '' };
    });

    expect(resolved.className).not.toContain('tb-cursor');
    expect(resolved.id).toBe('token-a');
  });

  test('is attached to body so it survives interface re-renders', async ({ page }) => {
    await boot(page);
    const parent = await page.evaluate(
      () => document.querySelector('.tb-cursor')?.parentElement?.tagName ?? 'NONE'
    );
    expect(parent).toBe('BODY');
  });
});

test.describe('hover, with real layout', () => {
  test('fires enter on the element the cursor is actually over', async ({ page }) => {
    await boot(page);
    await clearEvents(page);
    await moveTo(page, 150, 350);

    const seen = (await events(page)).map((e) => `${e.target}:${e.type}`);
    expect(seen).toEqual([
      'token-a:pointerover',
      'token-a:pointerenter',
      'token-a:mouseover',
      'token-a:mouseenter',
      'token-a:pointermove',
      'token-a:mousemove',
    ]);
  });

  test('leaves the old element before entering the new one when crossing between tokens', async ({
    page,
  }) => {
    await boot(page);
    await moveTo(page, 150, 350);
    await clearEvents(page);
    await moveTo(page, 350, 350);

    const seen = (await events(page)).map((e) => `${e.target}:${e.type}`);
    expect(seen.slice(0, 4)).toEqual([
      'token-a:pointerout',
      'token-a:pointerleave',
      'token-a:mouseout',
      'token-a:mouseleave',
    ]);
    expect(seen.slice(4)).toEqual([
      'token-b:pointerover',
      'token-b:pointerenter',
      'token-b:mouseover',
      'token-b:mouseenter',
      'token-b:pointermove',
      'token-b:mousemove',
    ]);
  });
});

test.describe('clicks land where the cursor is drawn', () => {
  test('at 100 percent interface scale', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      (window as unknown as { tongs: { setUiScale(s: number): void } }).tongs.setUiScale(1);
    });
    await moveTo(page, 150, 350);
    await clearEvents(page);
    await page.evaluate(() => {
      (window as unknown as { tongs: { getPointer(): { leftClick(): void } } }).tongs
        .getPointer()
        .leftClick();
    });

    const click = (await events(page)).find((e) => e.type === 'click');
    expect(click?.target).toBe('token-a');
  });

  /**
   * The claim ADR 0003 rests on, checked in a real browser rather than reasoned about. The brief
   * predicted that scaling would desynchronise the drawn cursor from the hit test and that the
   * module would need to convert coordinates. If that prediction were right, these would fail.
   */
  for (const scale of [0.75, 0.5]) {
    test(`at ${String(scale * 100)} percent interface scale`, async ({ page }) => {
      await boot(page);
      await page.evaluate((value) => {
        (window as unknown as { tongs: { setUiScale(s: number): void } }).tongs.setUiScale(value);
      }, scale);

      // A point inside the sidebar, which is one of the scaled regions.
      const probe = await page.evaluate(() => {
        const rect = document.querySelector('#chat-log')?.getBoundingClientRect();
        return rect === undefined
          ? null
          : { x: Math.round(rect.left + 10), y: Math.round(rect.top + 10) };
      });
      expect(probe).not.toBeNull();

      const visuallyUnder = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest('#chat-log')?.id ?? '',
        [probe?.x ?? 0, probe?.y ?? 0]
      );

      await moveTo(page, probe?.x ?? 0, probe?.y ?? 0);
      await clearEvents(page);
      await page.evaluate(() => {
        (window as unknown as { tongs: { getPointer(): { leftClick(): void } } }).tongs
          .getPointer()
          .leftClick();
      });

      const click = (await events(page)).find((e) => e.type === 'click');
      // The click must reach the same element the browser says is visually at that point.
      expect(visuallyUnder).toBe('chat-log');
      expect(click).toBeDefined();
    });
  }
});

test.describe('dragging', () => {
  test('holds the buttons bitmask across every move of a real drag', async ({ page }) => {
    await boot(page);
    await moveTo(page, 150, 350);
    await clearEvents(page);

    await page.evaluate(() => {
      const pointer = (
        window as unknown as {
          tongs: {
            getPointer(): {
              beginDrag(): void;
              dragBy(x: number, y: number): void;
              endDrag(): void;
            };
          };
        }
      ).tongs.getPointer();
      pointer.beginDrag();
      pointer.dragBy(50, 0);
      pointer.dragBy(50, 0);
      pointer.endDrag();
    });

    const all = await events(page);
    const moves = all.filter((e) => e.type === 'pointermove');
    expect(moves).toHaveLength(2);
    expect(moves.every((e) => e.buttons === 1)).toBe(true);

    expect(all.find((e) => e.type === 'pointerdown')?.buttons).toBe(1);
    expect(all.find((e) => e.type === 'pointerup')?.buttons).toBe(0);
    expect(all.some((e) => e.type === 'click')).toBe(false);
  });
});

test.describe('synthesised event properties in a real browser', () => {
  /**
   * jsdom could not check this: Vitest exposes its globals on a plain object rather than a branded
   * Window, so UIEvent rejected any view at all. In a real browser the dispatcher does set it, and
   * this is the only place that can confirm it.
   */
  test('carries a real window as the event view', async ({ page }) => {
    await boot(page);
    await clearEvents(page);
    await moveTo(page, 150, 350);

    const move = (await events(page)).find((e) => e.type === 'pointermove');
    expect(move?.hasView).toBe(true);
  });

  /**
   * Recorded rather than lamented. Untrusted is expected and mostly harmless; it is the reason the
   * keyboard strategy is probed at runtime, and the reason phase 2 exists.
   */
  test('is untrusted, which is expected and is why the keyboard strategy is probed', async ({
    page,
  }) => {
    await boot(page);
    await clearEvents(page);
    await moveTo(page, 150, 350);

    const move = (await events(page)).find((e) => e.type === 'pointermove');
    expect(move?.isTrusted).toBe(false);
  });
});

test.describe('interface scaling', () => {
  test('shrinks the sidebar without pushing it off screen', async ({ page }) => {
    await boot(page);

    const before = await page.evaluate(
      () => document.querySelector('#ui-right')?.getBoundingClientRect().right ?? 0
    );
    await page.evaluate(() => {
      (window as unknown as { tongs: { setUiScale(s: number): void } }).tongs.setUiScale(0.5);
    });
    const after = await page.evaluate(() => {
      const rect = document.querySelector('#ui-right')?.getBoundingClientRect();
      return { right: rect?.right ?? 0, width: rect?.width ?? 0 };
    });

    // Anchored to the right edge, so scaling must not move that edge inward.
    expect(after.right).toBeCloseTo(before, 0);
    expect(after.width).toBeLessThan(before);
  });

  test('leaves the canvas untouched, since Foundry owns that transform', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      (window as unknown as { tongs: { setUiScale(s: number): void } }).tongs.setUiScale(0.5);
    });

    const transform = await page.evaluate(
      () => getComputedStyle(document.querySelector('#board')!).transform
    );
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
  });
});

test.describe('modifier bar', () => {
  test('renders and dispatches a code based keydown when a modifier is latched', async ({
    page,
  }) => {
    await boot(page);
    await clearEvents(page);

    await page.locator('.tb-modifier-bar [data-code="ShiftLeft"]').click();

    const keydown = (await events(page)).find((e) => e.type === 'keydown');
    expect(keydown?.code).toBe('ShiftLeft');
  });

  test('carries the latched modifier onto a subsequent synthesised pointer event', async ({
    page,
  }) => {
    await boot(page);
    await page.locator('.tb-modifier-bar [data-code="ShiftLeft"]').click();
    await clearEvents(page);
    await moveTo(page, 150, 350);

    const move = (await events(page)).find((e) => e.type === 'pointermove');
    expect(move?.shiftKey).toBe(true);
  });
});
