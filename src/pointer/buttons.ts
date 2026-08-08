/**
 * Mouse button encoding.
 *
 * The DOM uses two unrelated numbering schemes on the same event and mixing them up is the classic
 * source of "right click does nothing". They are kept apart here deliberately.
 *
 * `button` identifies which single button changed state, and is meaningful only on down and up.
 * `buttons` is a bitmask of everything currently held, and it is the one that has to stay set
 * across a drag's move stream or Foundry will treat the drag as a hover.
 */

/** Values for MouseEvent.button. */
export const MouseButton = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
} as const;

export type MouseButtonValue = (typeof MouseButton)[keyof typeof MouseButton];

/** Bitmask values for MouseEvent.buttons. Note that middle and right are not in button order. */
export const ButtonsMask = {
  NONE: 0,
  LEFT: 1,
  RIGHT: 2,
  MIDDLE: 4,
} as const;

export type ButtonsMaskValue = (typeof ButtonsMask)[keyof typeof ButtonsMask];

/**
 * The value `button` must carry on events where no button changed state, such as pointermove and
 * pointerover. Zero would be wrong: it means the left button specifically, so a move reporting 0
 * looks like a left button event to anything inspecting it.
 */
export const NO_BUTTON_CHANGED = -1;

/** Maps a button to its position in the buttons bitmask. */
export function maskForButton(button: MouseButtonValue): ButtonsMaskValue {
  switch (button) {
    case MouseButton.LEFT:
      return ButtonsMask.LEFT;
    case MouseButton.RIGHT:
      return ButtonsMask.RIGHT;
    case MouseButton.MIDDLE:
      return ButtonsMask.MIDDLE;
  }
}

export function isButtonHeld(buttons: number, button: MouseButtonValue): boolean {
  return (buttons & maskForButton(button)) !== 0;
}

export function withButtonHeld(buttons: number, button: MouseButtonValue): number {
  return buttons | maskForButton(button);
}

export function withButtonReleased(buttons: number, button: MouseButtonValue): number {
  return buttons & ~maskForButton(button);
}
