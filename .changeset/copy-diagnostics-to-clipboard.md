---
'tongs-browser': minor
---

Copy the diagnostics report to the clipboard, not just to chat.

Asked for while debugging from a phone, and it removes the slowest and least reliable step in the
loop. A chat window on a phone shows about fifteen lines and silently hides the rest, and a report
has already been cut off exactly at the field the round existed to read, costing a full round trip.
Reading numbers off a screenshot is also how a two token coincidence was briefly mistaken for a fix.

⚠️ `navigator.clipboard` is gated to secure contexts, and a self hosted Foundry on a LAN address is
plain http, so on a phone it is simply undefined. That is exactly the setup this exists for, which
makes the `execCommand` fallback the path that matters and the modern API the optimisation. A copy
button that silently did nothing on the target device would be worse than no button.

The report still goes to chat as a record, and says whether the copy succeeded rather than leaving it
to be discovered by pasting nothing.
