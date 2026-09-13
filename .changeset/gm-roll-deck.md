---
'tongs-browser': minor
---

Add the GM roll deck: apply damage and roll saves from chat with large buttons, one card at a time.

A new GM-only tray button (🎲) opens a full-screen panel listing the chat messages that have
something to act on, oldest unhandled first. Each card's buttons say exactly what they do, such as
"Apply 7 piercing and fire to Xorn" or "Roll Will DC 17 for Goblin and Orc". Previous and Next move
between cards, and a card drops out once it is handled.

- **Damage goes through PF2e's own apply**, so resistances, weaknesses and immunities are applied
  exactly as the chat card's own button applies them. It hits the roll's target, and the GM's token
  selection is put back afterwards. A roll with no target asks who takes it.
- **Saves are rolled by PF2e's own save controls**, from a spell card's save button or an inline
  check, for the creatures you tap. No roll dialog opens.
- **Players never see it.** The button is GM only, the panel refuses to open for a player, and the
  deck lists only messages Foundry says the viewer can see.

Tested live on PF2e. SF2e shares the same code and reads its own flags, but has not been tested live yet. Swiping between cards will come later.
