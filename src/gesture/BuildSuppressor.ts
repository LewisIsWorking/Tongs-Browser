import { NativePointerSuppressor } from './NativePointerSuppressor.js';
import type { ExclusionZones } from './ExclusionZones.js';

/**
 * Building and binding the native pointer suppressor. Extracted from main 2026-08-12.
 *
 * Extracted because main crossed the 200 line limit, and because the two predicates it supplies are
 * the ones most worth having in one named place: they answer opposite questions about the same
 * element and the difference between them is a measured bug.
 *
 * ⚠️ Must be called at INIT, before Foundry builds the canvas. PIXI registers `pointerup` on the
 * WINDOW in the capture phase when its EventSystem is created, which happens with the canvas. Two
 * capture listeners on one node fire in registration order, so anything bound at `ready` is already
 * behind PIXI and cannot stop it. See NativePointerSuppressor for the measurement that forced this.
 *
 * ⚠️ Nothing unbinds it, deliberately. `enabled` is read live on every event, so it goes inert the
 * moment the module or the setting is switched off.
 */
export interface SuppressorDeps {
  readonly window: Window;
  readonly enabled: () => boolean;
  readonly exclusions: ExclusionZones;
}

export function buildSuppressor(deps: SuppressorDeps): NativePointerSuppressor {
  const suppressor = new NativePointerSuppressor({
    window: deps.window,
    enabled: deps.enabled,
    isExcluded: (target) => deps.exclusions.isExcluded(target),
    isOwnInterface: (target) => deps.exclusions.isOwnInterface(target),
  });
  suppressor.bind();
  return suppressor;
}
