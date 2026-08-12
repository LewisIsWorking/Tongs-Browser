import type { Browser, Page } from 'playwright';
import { connectCdpPage, type CdpPage } from '../cdp-page.ts';
import { launchBrowser } from '../foundry-session.ts';
import { MOBILE_DPR, USE_ANDROID, USE_MOBILE } from './Options.ts';

/**
 * Opening whichever surface the run asked for. Extracted from foundry-drag-check 2026-08-12.
 */
/** What was opened, and the device it reports itself as. */
export interface Surface {
  readonly browser: Browser | null;
  readonly page: Page | CdpPage;
  readonly device?:
    { width: number; height: number; devicePixelRatio: number; maxTouchPoints: number } | undefined;
}

export async function openSurface(): Promise<Surface> {
  /*
   * Two genuinely different surfaces, not one type with two shapes.
   *
   * Playwright's `Page` and the raw CDP stand in do the same job for the checks and are not
   * structurally compatible: Playwright's `evaluate` carries generic overloads nothing here can
   * satisfy. Rather than contort a common interface into existence, the union is kept honest and
   * narrowed at the two places where a Playwright only method is actually required.
   */
  const launched: {
    browser: Browser | null;
    page: Page | CdpPage;
    device?: { width: number; height: number; devicePixelRatio: number; maxTouchPoints: number };
  } = USE_ANDROID
    ? { browser: null, page: await connectCdpPage({ matchUrl: '/game' }) }
    : await launchBrowser(
        USE_MOBILE
          ? {
              hasTouch: true,
              isMobile: true,
              deviceScaleFactor: MOBILE_DPR,
              // A size Foundry accepts. See MOBILE_DPR's comment for why the phone's own 360x607
              // cannot be used here.
              viewport: { width: 1366, height: 768 },
            }
          : undefined
      );
  return launched;
}
