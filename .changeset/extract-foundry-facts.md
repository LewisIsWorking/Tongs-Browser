---
'tongs-browser': patch
---

Extract everything the diagnostics report reads out of Foundry into `debug/FoundryFacts.ts`, at 100%
coverage.

⚠️ Every field is now read **once**, in one pass. The report is a snapshot of a moment, and a field
read later than its neighbours describes a different moment: Foundry resets the interaction manager
as soon as a gesture ends, so two reads a few lines apart can straddle the very transition being
investigated.

The tests are about **honesty** rather than plumbing. Every field is read by somebody trying to work
out why a drag failed on a phone they cannot see, so a field that guesses is worse than one that
admits it does not know:

- **No game returns null, not a blank report.** A report full of "unknown" looks like a measurement
  that came back empty. It actually means the button was pressed before the world finished loading,
  which is a different thing for the reader to do about it.
- **`manifestVersion` is what Foundry LOADED**, not what was compiled. The two disagreeing is the
  "am I even running the version you think I am" question that cost a full round trip when a device
  reported against a stale copy.
- **`canDrag` is Foundry's own answer or `n/a`.** If it says false, the drag was never going to work
  and nothing else in the report matters, so guessing would be worse than admitting ignorance.

`TongsBrowser.ts` is down to 1,134 from 1,853 at the start of the day.
