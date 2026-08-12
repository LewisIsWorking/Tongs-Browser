---
'tongs-browser': patch
---

Extract pointer capture into `pointer/DragCapture.ts` at 100% coverage, and remove two duplications
in `VirtualPointer` that were each a drift risk. 259 lines down to 237.

**The capture** is the browser's implicit pointer capture, reimplemented, because a synthesised
pointer does not get it for free. It carries the bug behind "dragging a token does nothing" on a real
phone: VirtualPointer used to hit test afresh on every step, so the moment the pointer crossed a chat
window, the modifier bar or a sheet, the drag events went THERE and the canvas stopped hearing about
the drag. Measured on a device as `pointermove buttons=1 -> div#` when it needed `canvas#board`.
Never seen on desktop, because a drag across empty canvas never crosses anything.

The original reason for re-resolving was real and is preserved and now tested: Foundry re-renders
applications mid interaction, so a captured element can be **detached**, and dispatching at a
detached element throws the event away silently.

**Two duplications removed**, both the same shape as the two finger states earlier today: near
identical code differing by one value.

- `endDrag` and `cancelDrag` differed only in the sequence sent. Now one path with a parameter, with
  the target resolved BEFORE the flag is cleared, since resolving after would take the fallback path
  and hit test at wherever the drag ended rather than at whatever received the press.
- `dragBy` was a second copy of `applyMove`'s drag branch, and it is now routed through it. That is
  precisely what the comment in `applyMove` argues for: the copy in `moveTo`/`moveBy` was the one
  that forgot to keep the buttons bitmask set, which silently degraded a held grab into a hover.
  Routing on the drag STATE rather than on which method was called is what stops them drifting again.

613 tests green throughout, including the 512 line pointer suite, so behaviour is preserved. The
cursor now follows the CLAMPED position during a drag rather than the requested one, which is a small
improvement that fell out of the dedup.
