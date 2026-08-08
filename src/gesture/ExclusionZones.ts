import { IGNORE_ATTRIBUTE, IGNORE_ATTRIBUTE_VALUE } from '../constants.js';

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
  '#chat-log',
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
   */
  public isExcluded(target: EventTarget | null): boolean {
    if (target === null || !(target instanceof Element)) {
      return false;
    }
    return target.closest(this.selector) !== null;
  }

  /** Exposed for tests and diagnostics. */
  public getSelector(): string {
    return this.selector;
  }
}
