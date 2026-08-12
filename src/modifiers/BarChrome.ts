/**
 * The bar's own furniture: its root, its drag handle and its collapse button. Extracted from
 * ModifierBar 2026-08-12.
 *
 * Separated from the bar so the one line here that is load bearing can be asserted rather than
 * merely commented, and so `ModifierBar` reads as a bar that arranges parts rather than one that
 * also builds them.
 */
export interface BarChromeHandlers {
  readonly onHandlePointerDown: (event: PointerEvent) => void;
  readonly onHandlePointerMove: (event: PointerEvent) => void;
  /** Also the cancel handler, because a cancelled drag must let go exactly like a finished one. */
  readonly onHandlePointerUp: (event: PointerEvent) => void;
  readonly onCollapseToggled: () => void;
}

export interface BarChrome {
  readonly root: HTMLDivElement;
  readonly keysContainer: HTMLDivElement;
}

export function buildBarChrome(doc: Document, handlers: BarChromeHandlers): BarChrome {
  const root = doc.createElement('div');
  root.className = 'tb-modifier-bar';

  /*
   * ⚠️ Tells the gesture layer to keep away, and without it the bar cannot work at all.
   *
   * Every touch on the page is routed through the virtual pointer, so a tap on a modifier key would
   * be turned into a pointer event delivered wherever the pointer happens to be. The key would
   * modify a click somewhere else on the map rather than latching, which is the exact opposite of
   * what it is for.
   */
  root.setAttribute('data-tongs-browser', 'ignore');

  const handle = doc.createElement('div');
  handle.className = 'tb-modifier-bar__handle';
  handle.title = 'Drag to move';
  handle.addEventListener('pointerdown', handlers.onHandlePointerDown);
  handle.addEventListener('pointermove', handlers.onHandlePointerMove);
  handle.addEventListener('pointerup', handlers.onHandlePointerUp);
  /*
   * ⚠️ pointercancel goes to the SAME handler as pointerup. The browser cancels a pointer whenever
   * it takes the gesture over, and a bar that never hears about it is left believing a finger is
   * still down: the next unrelated move drags it across the screen.
   */
  handle.addEventListener('pointercancel', handlers.onHandlePointerUp);
  root.append(handle);

  const collapseButton = doc.createElement('button');
  collapseButton.type = 'button';
  collapseButton.className = 'tb-modifier-bar__collapse';
  collapseButton.textContent = '<';
  // A glyph has no accessible name of its own, and "<" reads as nothing to a screen reader.
  collapseButton.setAttribute('aria-label', 'Collapse modifier bar');
  collapseButton.addEventListener('click', handlers.onCollapseToggled);
  root.append(collapseButton);

  return { root, keysContainer: doc.createElement('div') };
}
