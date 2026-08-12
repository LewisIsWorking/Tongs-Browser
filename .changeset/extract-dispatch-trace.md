---
'tongs-browser': patch
---

Extract the dispatch trace ring buffer, at 100% coverage.

`debug/DispatchTrace.ts`, 80 lines. Its one piece of real behaviour, collapsing repeated lines into a
count, exists because of a measured failure rather than tidiness: a held pointer that is not moving
emits the same line hundreds of times, the buffer is eighteen entries long, and a moment of stillness
at the end of a gesture therefore erased the whole gesture before it. A device produced a trace
describing only the pause, which read as "the pointer never moved".

That collapse now has a test which fires two hundred identical moves after one real one and asserts
the real one survives.

`TongsBrowser.ts` is down from 1,853 to 1,615 across today's three extractions, with 461 tests.
