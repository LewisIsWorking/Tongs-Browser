import { TongsBrowser } from '../../../src/TongsBrowser.js';

/**
 * The whole module, constructed the way `main.ts` constructs it. Extracted from
 * moduleConstruction.test.ts 2026-08-13, when a second suite needed the same environment.
 *
 * ⚠️ Extracted rather than copied, and the difference matters here more than usual. This repo already
 * carries three hand copied versions of one diagnostics fixture, because the shared copy was made and
 * then not adopted. A second copy of THIS would be worse: it is an imitation of somebody else's API,
 * so the two copies would drift apart on the next Foundry upgrade and only one of them would be
 * fixed.
 */

/**
 * Everything the enable path reaches for, stubbed to the SHAPE it uses and nothing more.
 *
 * Deliberately minimal: a fuller fake would start describing Foundry, and a partial description of
 * somebody else's API that claims to be complete is worse than an obvious stub.
 */
export function stubFoundryEnvironment(): HTMLElement {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.append(host);

  /*
   * ⚠️ jsdom does not implement `elementFromPoint` AT ALL, and the grab button hit tests the moment
   * it is tapped. Without this a suite fails on the environment rather than on the module, which is
   * the least useful kind of red.
   */
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => host,
  });

  Object.assign(globalThis, {
    Hooks: { on: () => 1, off: () => undefined, once: () => 1 },
    game: {
      user: { id: 'u1', isGM: true },
      paused: false,
      socket: null,
      settings: { get: () => undefined, set: () => undefined },
    },
    ui: { notifications: { info: () => undefined } },
    CONFIG: { Canvas: { minZoom: 0.1, maxZoom: 10 } },
    ChatMessage: { create: () => undefined },
    /*
     * ⚠️ Vite `define`s this at build time, so it simply does not exist under test. The diagnose
     * button reads it, and an undefined global there throws where a missing STRING would not.
     */
    __TB_BUILD_VERSION__: '0.0.0-test',
  });

  return host;
}

/** The options main.ts passes, with the settings it reads already resolved. */
export function buildModule(overrides: Record<string, unknown> = {}): TongsBrowser {
  return new TongsBrowser({
    document,
    window,
    /*
     * ⚠️ No `eventView`, deliberately. vitest's jsdom window is not a BRANDED Window, so
     * `new PointerEvent({ view })` rejects it. Event attribution is covered by the pointer suites.
     */
    suppressNativeTouch: () => true,
    ...overrides,
  });
}
