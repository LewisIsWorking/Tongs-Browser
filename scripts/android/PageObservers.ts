import type { Page } from 'playwright';

/**
 * Watching the page: its errors, its logs, and the font shim. Extracted from foundry-android-check
 * 2026-08-12.
 */
/**
 * A page error, kept whole.
 *
 * ⚠️ The stack is a separate field rather than folded into the message, because attribution reads it
 * and the message alone does not carry it. Foundry's own `RegExp.escape` failure has a message that
 * names neither Foundry nor this module.
 */
export interface PageErrorRecord {
  readonly message: string;
  readonly stack: string;
}

/**
 * Page errors, kept with their stacks so they can be attributed.
 *
 * Attribution is the point. Foundry 14.365 calls RegExp.escape, which Chromium only shipped in 136,
 * so on an older device Foundry throws errors of its own before this module does anything at all.
 * Failing on every page error would blame us for the browser; ignoring every page error would blind
 * the check. Matching the stack against our own bundle name splits them correctly.
 */
export function captureAttributedErrors(page: Page): PageErrorRecord[] {
  const errors: PageErrorRecord[] = [];
  page.on('pageerror', (error) => {
    errors.push({ message: error.message, stack: error.stack ?? '' });
  });
  return errors;
}

/**
 * Compensate for a Chromium font bug that has nothing to do with this module, and say so out loud.
 *
 * Measured 2026-08-10 on the coo_phone emulator, Chromium 133 against Foundry 14.365:
 * fonts/fontawesome/webfonts/fa-duotone-900.woff2 downloads perfectly, HTTP 200 and 326,968 bytes,
 * and then fails to decode. Chromium reports an OTS font parse failure as
 * `NetworkError: A network error occurred.`, which is why this reads as a connectivity problem and
 * is not one. Its sibling fonts decode fine, so it is that one WOFF2 and that one browser version.
 *
 * Foundry does not catch the resulting rejection, so startup stops: game.ready stays false forever
 * while the interface renders completely, which looks exactly like a module having broken the world.
 * Proven by experiment rather than assumed: swallowing only this rejection takes ready from
 * never-true to true in ten seconds, canvas included.
 *
 * The shim is deliberately narrow. It swallows font decode failures and nothing else, it is applied
 * only by this Android harness and never by the module or by any other check, and every font it
 * swallows is reported as a check result. An environment fix that hides itself would be worse than
 * the bug, because every later result would rest on it silently.
 */
export async function installFontDecodeShim(page: Page) {
  await page.addInitScript(() => {
    globalThis.__tbSwallowedFonts = [];
    const original = FontFace.prototype.load;
    FontFace.prototype.load = function patched(...args) {
      return original.apply(this, args).catch((error) => {
        globalThis.__tbSwallowedFonts.push(`${this.family}: ${error.name}: ${error.message}`);
        return this;
      });
    };
  });
}

export function captureLog(page: Page) {
  const log: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('Tongs Browser')) {
      log.push(`${message.type()}: ${text}`);
    }
  });
  return log;
}
