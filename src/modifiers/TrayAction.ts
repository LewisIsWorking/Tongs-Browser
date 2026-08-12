/**
 * A utility button on the bar. Its own file 2026-08-12, so `ActionButtons` can describe one without
 * importing `ModifierBar`, which imports `ActionButtons`.
 */
/** A utility button on the bar, such as showing Foundry's sidebar. */
export interface TrayAction {
  readonly id: string;
  /** Short glyph or text shown on the button. */
  readonly label: string;
  /** Used for the tooltip and the accessible name. */
  readonly title: string;
  readonly activate: () => void;
  /**
   * Whether the thing this button controls is currently ON.
   *
   * Optional, because most actions are momentary and have no state to show. For the ones that do,
   * such as pause or a held grab, a button that looks identical whether the game is running or
   * frozen is worse than no button: it invites a second tap that undoes the first.
   */
  readonly isActive?: () => boolean;
  /**
   * The label to show right now, when it depends on state.
   *
   * ⚠️ Added 2026-08-11 because a latched button whose label never changes cost a whole round of
   * device diagnostics. The grab button holds the mouse button down until it is tapped again, and it
   * showed the same open hand whether it was holding a token or idle. The gold latched styling says
   * "on", but "on" does not tell you that the next thing to do is tap it OFF, and a token stays
   * exactly where it was until the grab is released. A device report came back with the drag never
   * dropped and the token never moved, which read as a broken drag and was a control that did not
   * say what it wanted.
   *
   * Colour alone was never going to carry this. The word is the fix.
   */
  readonly getLabel?: () => string;
  /** Buttons sharing a group are rendered together, so related controls cluster rather than wrap. */
  readonly group?: string;
}
