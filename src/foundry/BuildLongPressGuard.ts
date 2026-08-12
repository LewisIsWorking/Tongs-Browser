import { LongPressGuard } from './LongPressGuard.js';

/**
 * Reaching Foundry's MouseInteractionManager class through a live token. Extracted from ModuleParts
 * 2026-08-13.
 *
 * ⚠️ Through an INSTANCE's constructor, because the class is not otherwise exposed on a global this
 * module can rely on. `longPressTimeout` is a static, so the class is the only correct place to
 * clear it: see LongPressGuard for why writing through an instance silently does nothing.
 *
 * ⚠️ Reproduced on desktop 2026-08-13 with `check:drag --mobile --hold=700`: holding the grab for
 * 700ms before moving drops the token from moved YES at peak state DRAG(4) to moved NO at NONE(0).
 * With `--hold=0`, which is what every earlier run did, it passes.
 *
 * Read live on every disarm rather than resolved once. There is no controlled token before the
 * canvas is up, and the canvas is torn down and rebuilt whenever the scene changes.
 */
interface ControlledTokenGlobals {
  readonly canvas?: {
    readonly tokens?: {
      readonly controlled?: readonly { readonly mouseInteractionManager?: unknown }[];
    };
  };
}

export function buildLongPressGuard(win: Window): LongPressGuard {
  return new LongPressGuard({
    getManagerClass: () => {
      const manager = (globalThis as ControlledTokenGlobals).canvas?.tokens?.controlled?.[0]
        ?.mouseInteractionManager;
      if (manager === undefined || manager === null) {
        return undefined;
      }
      return (manager as { constructor?: unknown }).constructor as
        { longPressTimeout?: unknown } | undefined;
    },
    clearTimeout: (handle) => {
      win.clearTimeout(handle);
    },
  });
}
