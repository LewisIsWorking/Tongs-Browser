import {
  IGNORE_ATTRIBUTE,
  IGNORE_ATTRIBUTE_VALUE,
  NATIVE_POINTER_ATTRIBUTE,
} from '../constants.js';

/**
 * Places the gesture layer must keep its hands off.
 *
 * Hijacking every touch on the document would break the parts of Foundry that already work
 * perfectly well on a touch screen. Typing in chat needs the real keyboard and a real caret.
 * Scrolling the chat log, the sidebar, and any long list needs native momentum scrolling, which
 * cannot be reproduced convincingly by synthesising wheel events.
 *
 * Anything matching one of these selectors, or contained within something that does, is left
 * entirely alone: no preventDefault, no pointer synthesis, nothing.
 */
const EXCLUDED_SELECTORS: readonly string[] = [
  'input',
  'textarea',
  'select',
  'option',
  '[contenteditable]:not([contenteditable="false"])',
  // Foundry's chat log and sidebar scroll regions, across both the legacy and ApplicationV2 markup.
  //
  // ⚠️ `.chat-log` added 2026-08-09 after auditing these against a live 14.365. The id form matched
  // NOTHING on that build: the log is `<ol class="chat-log">`, a class, and the id belongs to the
  // v12 markup. The behaviour survived only because `.chat-scroll` wraps the log and `closest` found
  // that instead, which is luck rather than design. The id is kept for older versions.
  '#chat-log',
  '.chat-log',
  '#chat-message',
  '.chat-scroll',
  '#sidebar',
  '.sidebar-tab',
  '.scrollable',
  '.window-content',
  // Explicit opt out for anything else, including other modules.
  `[${IGNORE_ATTRIBUTE}="${IGNORE_ATTRIBUTE_VALUE}"]`,
];

const EXCLUDED_SELECTOR = EXCLUDED_SELECTORS.join(',');

export interface ExclusionOptions {
  /** Extra selectors, so a user or another module can widen the set without a code change. */
  readonly additionalSelectors?: readonly string[];
}

export class ExclusionZones {
  private readonly selector: string;

  public constructor(options: ExclusionOptions = {}) {
    const extra = options.additionalSelectors ?? [];
    this.selector =
      extra.length === 0 ? EXCLUDED_SELECTOR : [EXCLUDED_SELECTOR, ...extra].join(',');
  }

  /**
   * True when the gesture layer must not act on this element.
   *
   * Uses closest rather than matches, so a tap on a span inside a contenteditable, or on a message
   * inside the chat log, is excluded along with its container. Checking only the exact element hit
   * would leak every nested child.
   *
   * ⚠️ Accepts `undefined` as well as `null`, widened 2026-08-17. Callers pass `Touch.target`, which
   * the DOM lib types as always present and which a tablet engine is under no obligation to actually
   * provide. The runtime check already covered it, since `undefined instanceof Element` is false, so
   * this only makes the signature honest about what it is handed. An unattributable target is NOT
   * excluded, so the caller keeps that finger rather than silently dropping it.
   */
  public isExcluded(target: EventTarget | null | undefined): boolean {
    if (!(target instanceof Element)) {
      return false;
    }
    return target.closest(this.selector) !== null;
  }

  /**
   * True when this is the module's OWN interface, rather than somebody else's excluded region.
   *
   * ⚠️ The two are NOT the same question, and treating them as one is a measured bug. The gesture
   * layer must keep away from our own bar, or a tap on a modifier key would be turned into a pointer
   * event delivered wherever the pointer happens to be. The NATIVE POINTER SUPPRESSOR must do the
   * opposite: a real finger on our bar produces trusted `pointerdown` and `pointerup` at the window,
   * PIXI listens there in the capture phase and maps events onto the canvas BY COORDINATE rather
   * than by DOM target, and the bar sits over the canvas. Foundry then receives a pointerup it was
   * never meant to see and `#handlePointerUp` ends with `#handleDragCancel`.
   *
   * Measured 2026-08-12: one finger tap on the grab button put seven trusted events on the window,
   * including a `pointerup` with `pointerType: 'touch'`, all at the button's own coordinates.
   *
   * Chat and inputs keep their events, because those regions genuinely need native behaviour and are
   * not ours to interfere with. Our own furniture has no such claim.
   */
  public isOwnInterface(target: EventTarget | null): boolean {
    if (target === null || !(target instanceof Element)) {
      return false;
    }
    return target.closest(`[${IGNORE_ATTRIBUTE}="${IGNORE_ATTRIBUTE_VALUE}"]`) !== null;
  }

  /**
   * True when this control needs the browser's real pointer events, despite being ours.
   *
   * ⚠️ A NARROW hole in `isOwnInterface`, and it has to be narrow. Suppression over our own bar is
   * measured and load bearing: a finger's `pointerup` reaching PIXI runs `#handlePointerUp`, which
   * ends in `#handleDragCancel` and throws away a held token drag. That is what makes tapping DROP
   * work at all.
   *
   * But the suppressor stops events at the WINDOW in the capture phase, upstream of everything, so
   * "PIXI must not see it" was implemented as "nobody sees it" and the bar's own drag handle stopped
   * receiving the `pointerdown` it is built on. Reported 2026-08-13: "I can't move the tongs toolbox
   * now."
   *
   * Only the drag handle is marked, so a tap on a tray button is still suppressed. The residual risk
   * is dragging the BAR while a token drag is held, which would let that gesture's pointerup through;
   * that is a narrower and stranger case than being unable to move the bar at all.
   */
  public needsNativePointerEvents(target: EventTarget | null): boolean {
    if (target === null || !(target instanceof Element)) {
      return false;
    }
    return target.closest(`[${NATIVE_POINTER_ATTRIBUTE}]`) !== null;
  }

  /** Exposed for tests and diagnostics. */
  public getSelector(): string {
    return this.selector;
  }
}
