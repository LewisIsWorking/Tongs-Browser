import type { Page } from 'playwright';
import type { CdpPage } from '../cdp-page.ts';

/**
 * Run something in the page, whichever kind of page it is. Extracted from foundry-drag-check
 * 2026-08-12.
 *
 * ⚠️ Playwright's `Page` and the raw CDP client are two genuinely different surfaces, not one type
 * with two shapes. They agree on exactly this call and nothing else, which is why the harness can be
 * pointed at a desktop browser or at a phone over adb without the checks knowing which.
 */
/**
 * Evaluate on either page surface.
 *
 * Both do exactly the same thing at runtime; they differ only in generic plumbing, and Playwright's
 * overloads make the union uncallable without help. One documented adapter beats a cast at every
 * call site, and it keeps the check body identical for desktop and device.
 */
export function evaluateOn<T>(
  target: Page | CdpPage,
  fn: (arg: never) => T | Promise<T>,
  arg?: unknown
): Promise<T> {
  return (target as CdpPage).evaluate(fn, arg);
}
