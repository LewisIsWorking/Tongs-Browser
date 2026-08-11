---
'tongs-browser': minor
---

The grab button now says `DROP` while it is holding something, and the diagnostics report says
outright whether the token moved.

Dragging a token was reported broken three times. It is not broken. Measured against a live Foundry
14.365 with the new `npm run check:drag`: our pointer, Foundry's recorded drag destination, the drag
clone and the committed token document all track a 240px drag exactly, and the move commits.

What was broken is that the grab button holds the mouse button down until it is tapped again and
showed the same open hand either way. Foundry only commits a token move on the **drop**, so a held
grab leaves the token precisely where it started, which from the other side of the screen is
indistinguishable from a drag that does nothing. The latched gold styling says "on", and "on" does
not tell you that the next thing to do is tap it off.

The report gained two lines above everything else, because every field it had answered a question
about events rather than the question anyone was asking:

- **DID IT MOVE**, comparing the token's position at the grab against its position now.
- **released during drag**, which names the trap outright when a report is taken mid gesture.
