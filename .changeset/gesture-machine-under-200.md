---
'tongs-browser': patch
---

Split the gesture machine into `SingleFingerStates` and `SettledStates`.
**`GestureStateMachine.ts` drops from 330 to 146**, and every gesture file is now under the limit.
742 tests green, including the 381 line state machine suite.

The split follows what the states actually share rather than their order in the file:

- **The machine** keeps the dispatch, the config and the two finger states.
- **`SingleFingerStates`** keeps the two states where the gesture's identity is still being decided,
  which need five fields between them: where the touch began, when, whether it follows a previous
  tap, and what that tap was.
- **`SettledStates`** keeps the two where it is already decided, which need only the last position.
  TRACKING means the finger is moving the pointer and the release must NOT produce a click; DRAGGING
  means a button is held and every move carries it.

A class holding both sets is a class where any handler can reach any field.

⚠️ **A correction, because I claimed something and then disproved it.** Moving the position out
dropped a line from `reset`, and I described that as a real gap the suite had missed. It is not: a
stale last position is unobservable, because every fresh gesture starts at a `touchstart` and
`fromIdle` writes the position before any move can read it. Removing the line leaves the whole suite
green, which was checked by removing it rather than assumed. The line stays for hygiene, the comment
now says so, and the test that came out of it was rewritten to pin the outcome a user would notice
rather than to claim a guard it does not provide.

Production files over 200 lines: **five this morning, one now**.
