---
'tongs-browser': patch
---

`DragDiagnostics` was 73% covered with 50% of branches, and the untested part was the wiring between
its three pieces rather than any of the pieces themselves.

The journal that records causes, the recorder that measures, and the observers that watch Foundry are
each covered on their own. Nothing covered whether they are connected correctly, which is where a
silent failure lives: every component stays green while the report loses the entries that make it
worth reading.

Now asserted: a dispatch reaches both the measurements and the timeline, raw gesture input reaches the
timeline, and a tray press is recorded. That last one matters most, because a control the user touched
is the single most useful entry in the whole report and it is the one class of entry a snapshot can
never reconstruct. Also that reporting with no Foundry present returns quietly instead of throwing,
since it runs on a phone at the moment somebody is already investigating a failure.

⚠️ One test was removed before it was ever committed. It ended in `expect(...).toBeDefined()`, which
cannot fail, because this class exposes no way to read the observers' resize count without a live
Foundry to build a report against. The rule it would have covered is asserted where it can actually be
checked, in the observers' own suite. A second weaker version here would have added a passing line and
no protection.

`src/debug` reaches 98.9% statements and 96.5% branches; the project 95.1% to 95.4%.
