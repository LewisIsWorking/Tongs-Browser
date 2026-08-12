---
'tongs-browser': patch
---

Extract how the diagnostics report reaches somebody holding a phone, at 100% coverage.

Chat AND clipboard, not either. Reading the report off a screenshot is the slowest part of this loop
and it TRUNCATES: a phone chat window shows about fifteen lines and silently hides the rest, which
already cost a full round trip on the one field that mattered. The clipboard carries the whole thing
and the chat message is what makes it visible that a report exists at all.

One behaviour is now pinned by a test that would be very easy to get backwards: **an absent user id
whispers to NOBODY.** Foundry treats an empty whisper array as "everyone", so defaulting the other
way would broadcast a diagnostic to the whole table at the exact moment something is going wrong.

`TongsBrowser.ts` is down from 1,853 to 1,361 across today's extractions, with nine new modules all
under 200 lines and all at 100% on statements, branches, functions and lines.
