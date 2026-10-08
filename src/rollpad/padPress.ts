/**
 * A tap or a long press on one Roll Pad button. Added 2026-10-08.
 *
 * A tap rolls straight away; holding for `HOLD_MS` rolls through PF2e's dialog, for a situational
 * modifier. The hold fires WHILE the finger is still down, so the player knows it took, and the lift
 * that follows does nothing.
 *
 * ⚠️ Pointer events, not `click`: a click cannot tell a tap from a hold. `click` is still listened to
 * for the keyboard (Enter or Space give a click with `detail === 0`), which taps.
 *
 * ⚠️ A finger that slides off the button, or that the browser takes for a scroll (`pointercancel`),
 * rolls nothing. The pad scrolls on a phone, and a scroll must never roll.
 */
export const HOLD_MS = 500;

export interface PressActions {
  readonly tap: () => void;
  readonly hold: () => void;
}

export function bindPress(button: HTMLButtonElement, actions: PressActions): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  button.addEventListener('pointerdown', () => {
    cancel();
    timer = setTimeout(() => {
      timer = null;
      actions.hold();
    }, HOLD_MS);
  });
  button.addEventListener('pointerup', () => {
    if (timer !== null) {
      cancel();
      actions.tap();
    }
  });
  button.addEventListener('pointerleave', cancel);
  button.addEventListener('pointercancel', cancel);
  /* A long press would otherwise open the phone's own menu over the pad. */
  button.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
  button.addEventListener('click', (event) => {
    if (event.detail === 0) {
      actions.tap();
    }
  });
}
