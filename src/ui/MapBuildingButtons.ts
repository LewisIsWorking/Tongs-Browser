import type { TrayAction } from '../modifiers/ModifierBar.js';
import type { TrayActionHandlers } from './TrayActions.js';

/**
 * The GM map-building cluster. Added 2026-09-09, closing the last six real gaps in
 * `scripts/keybindings/coverage.ts`.
 *
 * ⚠️ WORDS, NOT GLYPHS, and that is a decision rather than laziness. There is no glyph anybody agrees
 * means "send to back", and the near misses (⤓ ⧉ ⬚) are exactly the characters a phone font is most
 * likely to render as a tofu box. A button labelled □ is a dead control: it cannot be guessed, and
 * the title that would explain it is a hover, which a touch screen does not have. Multi-character
 * labels are already established here anyway; the momentary bar carries `Space` and `Enter`.
 *
 * ⚠️ ONE GROUP, so six new buttons cluster instead of wrapping through the pan arrows on a 412px bar.
 *
 * ⚠️ These are GATED, in `TrayActions`. Six controls that a player may never use are six controls in
 * the way of the ones they need, and unlike the create button there is no version of this a player
 * can be given: Foundry refuses the underlying operations to anyone who is not a GM, so a player
 * pressing them would get silence.
 */
export function mapBuildingButtons(handlers: TrayActionHandlers): readonly TrayAction[] {
  return [
    {
      id: 'select-all',
      label: 'All',
      title: 'Select everything on this layer, the same as Ctrl+A',
      group: 'map',
      activate: handlers.selectAll,
    },
    {
      id: 'cut',
      label: 'Cut',
      title: 'Cut the selection, the same as Ctrl+X',
      group: 'map',
      activate: handlers.cut,
    },
    {
      id: 'copy',
      label: 'Copy',
      title: 'Copy the selection, the same as Ctrl+C',
      group: 'map',
      activate: handlers.copy,
    },
    {
      id: 'paste',
      label: 'Paste',
      title: 'Paste at the pointer, the same as Ctrl+V',
      group: 'map',
      activate: handlers.paste,
    },
    /*
     * ⚠️ The titles say `[` and `]` rather than Ctrl+something, because that is what these two
     * actually send. Foundry binds the z-order pair to the bare bracket keys. See
     * `modifiers/mapBuildingKeys.ts` for why that difference is load-bearing.
     */
    {
      id: 'send-to-back',
      label: 'Back',
      title: 'Send the selection behind everything else, the same as [',
      group: 'map',
      activate: handlers.sendToBack,
    },
    {
      id: 'bring-to-front',
      label: 'Front',
      title: 'Bring the selection in front of everything else, the same as ]',
      group: 'map',
      activate: handlers.bringToFront,
    },
  ];
}
