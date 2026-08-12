---
'tongs-browser': patch
---

Extract `foundry/AvailableWidth.ts` and `foundry/CanvasReaders.ts`, both at 100% coverage.
`TongsBrowser.ts` 1,134 to 1,101.

**Available width** is the other half of the sidebar avoidance in `BarClamp`: that one decides where
the bar goes given a width, this one decides what the width is. Three separate ways the sidebar can
be present in the DOM and still not be in the way, all now tested:

1. **Zero width.** Foundry COLLAPSES the sidebar rather than removing it, so a collapsed sidebar is
   still an element with a box. Treating it as an obstacle shrinks the bar to nothing for a user who
   deliberately made room.
2. **Entirely off the right edge**, mid animation or on a layout wider than the window.
3. **Entirely off the left edge.**

Plus: never negative, since a negative available width makes every clamp downstream nonsense.

**The canvas readers** all read FRESH rather than caching, which is the point of gathering them.
Foundry fits a scene to the viewport on load, the user can zoom with the wheel or Foundry's own
controls, and a scene change replaces the stage outright. A stale scale silently multiplies into
every pinch that follows.

The pivot reader now has a test for something that was true and unstated: **it copies rather than
handing back PIXI's live object**, which mutates in place on every pan. Returning the live one gives
the caller a value that changes underneath it, so a "before" reading taken for comparison silently
becomes the "after" one and every delta measures zero. That is exactly the failure the drag
diagnostics have been chasing all week.

`readZoomLimits` falls back **per bound** rather than all or nothing, because these have moved
between Foundry versions and a missing one produces NaN scales, which render as a blank canvas with
no error anywhere.

Also removes an orphaned duplicate docblock left in `TongsBrowser` by the earlier `SidebarAccess`
extraction. Its content already lives in that file; two stacked docblocks was a leftover from that
edit, not a second explanation.
