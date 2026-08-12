---
'tongs-browser': patch
---

Turn the touch binder's listener registration into an asserted table, `gesture/TouchListenerSpecs.ts`.
`TouchBinder.ts` drops from 251 lines to **189, under the limit**.

⚠️ **Every entry encodes a bug that took a physical device to find, and each is one option flag away
from silently not working.** A bubble phase listener still fires. A passive one still runs. Both look
completely normal in a debugger while the behaviour they exist to prevent goes straight past them.
That is why these are now data with assertions rather than a run of `addEventListener` calls.

The test that earns this is the roster:

> **`pointercancel` was missing for weeks.** A touchscreen fires it whenever the browser takes a
> gesture over; a mouse never fires it at all; and Foundry treats it as an ABORT that discards the
> drag origin its 10px gate measures from. Desktop could not see the gap, and nothing in the code
> looked wrong: the three siblings were right there, and the fourth simply was not.

Also asserted: **capture on every one, without exception**, and **passive false on exactly the four
that call `preventDefault`**.

Writing the table exposed a smaller problem of its own. The `because` field started out saying "the
same" for five of the nine entries, and the test requiring a real reason failed on them. A table
meant to be readable standalone cannot cross-reference its own rows, so each now says what it is for.
