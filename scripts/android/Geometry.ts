import type { Page } from 'playwright';
import { MODULE_ID } from '../foundry-session.ts';

/**
 * Measuring what the user has to be able to hit. Extracted from foundry-android-check 2026-08-12.
 */
/**
 * A measured box. `right` and `bottom` are carried rather than derived, because every assertion here
 * is an overlap or a containment test and recomputing them at each call site is where sign errors get
 * in: `a.x + a.width > b.x` reads correctly and is wrong for a box with a negative x.
 */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly right: number;
  readonly bottom: number;
}

/** Geometry of the things the user has to be able to hit, measured in the live page. */
export function readGeometry(page: Page) {
  return page.evaluate((id: string) => {
    const measure = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    /*
     * Null only where the element genuinely might be missing. The bar's own buttons come from
     * querySelectorAll and so always exist, and measuring them through the nullable form used to
     * spread `null` into the result: a control with no coordinates at all, which then printed
     * `at x NaN-NaN` in the very failure message meant to say where it had gone.
     */
    const rect = (el: Element | null): Rect | null => (el === null ? null : measure(el));
    const toggle = document.querySelector(`[data-tool="${id}"]`);
    const bar = document.querySelector('.tb-modifier-bar');

    let reachable = null;
    let topmost = null;
    if (toggle) {
      const r = toggle.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      reachable = toggle === top || toggle.contains(top);
      topmost = top ? `${top.tagName.toLowerCase()}.${String(top.className)}` : null;
    }

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      toggle: rect(toggle),
      toggleReachable: reachable,
      toggleTopmost: topmost,
      bar: rect(bar),
      barControls: [...document.querySelectorAll('.tb-modifier-bar button')].map((b) => ({
        label: (b.textContent ?? '').trim() || b.className,
        ...measure(b),
      })),
    };
  }, MODULE_ID);
}

export const overlaps = (a: Rect | null, b: Rect | null): boolean =>
  a !== null && b !== null && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;

export const insideViewport = (
  r: Rect | null,
  viewport: { readonly width: number; readonly height: number }
): boolean =>
  r !== null && r.x >= 0 && r.y >= 0 && r.right <= viewport.width && r.bottom <= viewport.height;
