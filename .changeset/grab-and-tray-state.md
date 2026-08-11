---
'tongs-browser': minor
---

Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

**Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
A drag required tap, lift, press again inside the double tap window, hold past the long press timer
without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
it wrong while looking at the map rather than at your thumb. It passed every test, because it does
work; working and usable are different claims.

The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
half of the same complaint.

⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
new button and then continued by ordinary pointer movement silently degraded into a hover: measured
on a device, the button was held, the pointer glided over the token, and the token did not move.
`applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
Verified end to end: token x 800 to 1200.

**Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
another player's request arrives through the relay.

The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.
