---
'tongs-browser': patch
---

Extract the sidebar button's DECISION, which was wrong twice before it was right.

`decideSidebarAction` returns what the button should do rather than doing it, so the reasoning is
testable without a DOM and the DOM work stays where the DOM is. The ordering encodes two things a
device taught us, and both replaced something that looked obviously correct:

1. **Pop a tab OUT rather than expanding the docked sidebar.** Toggling `expanded` genuinely flips
   and nothing appears, because the docked sidebar is a column pinned to the right edge of a layout a
   phone browser does not place where the maths says. A popped out tab is an ordinary application
   window, which `WindowClampBinder` already keeps inside the viewport, so it is visible by
   construction rather than by luck.
2. **Offer EVERY tab, not just the active one.** Popping out the active tab gave chat and nothing
   else, because the only way to change tabs is the docked tab strip, which is the 27px column that
   started all of this.

Expanding the docked sidebar survives as the last resort, for a build with nothing to pop out, and
there is a test asserting it stays last.

`SidebarAccess.ts` is at 100% on all four metrics and `TongsBrowser.ts` is down from 1,853 to 1,377.
