---
'tongs-browser': patch
---

Measure how far the pointer travelled from the grab, against nothing but ourselves.

Three device reports came back unreadable for the same reason: every distance in them was computed
against something Foundry owns, so when Foundry's numbers came back as zeros there was no way to tell
which of two completely unrelated bugs was in front of us.

- The pointer travelled a long way and Foundry's drag origin **followed it**, so its 10px gate can
  never open, or
- the pointer only travelled 8px, Foundry is entirely right to refuse, and the real complaint is how
  far a finger has to move to get the pointer anywhere.

Both produce `gate distance 0.0`. Both produce a token that does not move. They share no fix.

The report now leads with **OUR pointer travelled**, measured from our own grab point using only our
own state, and says outright which case it is. It cannot be confounded by whatever Foundry is doing,
which is the entire point of it.

The previous round's measurement did its job and is worth recording: `ours vs PIXI during the drag`
came back **0.0px apart at worst**, which refutes the theory that PIXI was not receiving our
synthesised events on a touch device. PIXI tracks the virtual pointer exactly.
