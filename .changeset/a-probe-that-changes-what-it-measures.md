---
'tongs-browser': patch
---

`DebugOverlay` was 40% covered, and it is a probe, so the untested half mattered more than usual.

It draws an outline around whatever the pointer resolved to, because when a tap does nothing there is
no way to tell from the screen whether the pointer resolved the wrong element, resolved the right one
and the event was ignored, or never dispatched at all.

The tests are about it not changing what it measures. It must not be hit testable, or it becomes the
answer to every hit test the moment it is drawn and the thing being diagnosed stops working while
being diagnosed. It must draw and log nothing while switched off. And it must never leave a stale
rectangle pointing at an element the pointer has since left, which quietly contradicts the pointer
during exactly the investigation it exists to help.

Each of those turns a test red when broken.

⚠️ A fourth test was written and then deleted. Mutation checking showed "enabling twice does not
attach two outlines" passed with the guard removed, because `append` moves an element already in the
document rather than duplicating it, so a second outline is impossible either way. A test that cannot
fail still counts, still runs and still reads like protection, so its absence is now recorded in the
file instead.

`DebugOverlay.ts` 40% to 97.6%, `src/debug` to 95.7%, the project 93.1% to 94.6%.
