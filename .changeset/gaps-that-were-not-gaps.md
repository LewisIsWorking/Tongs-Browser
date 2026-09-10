---
'tongs-browser': patch
---

Four keybindings recorded as unreachable are reachable, and always were.

The coverage table asks whether a phone can reach each of Foundry's capabilities. Four entries had
answered a different question: whether a phone can press the KEY. That is a narrower question, and
answering it instead produced four gaps that do not exist.

Checked against Foundry 14.367's own source, not reasoned about:

- **`ascend` and `descend`** are the Token HUD's elevation field, whose handler calls
  `document.move(...)`. A long press is a right click in this module, and a right click opens that
  HUD. `descend` had been recorded as a gap for as long as the table existed. `ascend` was added as
  one earlier the same day, on the strength of "a phone cannot send KeyE", which is true and is not
  the question.
- **`unconstrainedMovement`** is a toggle tool in the token scene controls (`fa-ghost`, GM only)
  setting the same core setting the key does. The toggle is BETTER than the key on a phone: the key
  is held during a drag, and this module's sticky bar releases on the next action rather than on drop.
- **`rulerWaypoint`** is Ctrl+click by Foundry's own toolclip, with right click to remove. The bar
  latches Ctrl and a long press is a right click, so both halves are already reachable. The KeyF
  shortcut is not reachable; the capability is, and those are different claims.

The table now reads 8 reachable through Foundry's own UI where it read 4, and 13 unreachable where it
read 17.

**The bias only ran one way, which is why it is worth naming rather than just fixing.** Reasoning
from the key can invent gaps but can never hide one, so the table was pessimistic rather than
unreliable. The cost is real anyway: a reader would have been sent to build controls for things
Foundry already offers, which is how a phone ends up with a bar full of buttons duplicating its own
UI. Before writing `gap`, go and look at what the on-screen UI does.

The four straight token moves are deliberately left as gaps. Dragging reaches them and the notes say
so, but whether freehand dragging is the same capability as a one-square keyboard step is a judgement
rather than something the source settles, and four corrections in one direction is where
over-correcting starts.
