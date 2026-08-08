---
'tongs-browser': minor
---

Add interface scaling and application window clamping.

Foundry's HTML chrome is scaled by a single CSS custom property, between 50 and 100 percent in five
percent steps, with each region anchored to the edge it is pinned to. The canvas is never scaled.
Application windows are clamped into the viewport for both the legacy and ApplicationV2 systems,
since a sheet opening off screen on a touch device takes its close button with it and cannot be
recovered.

Also corrects a premise carried from the original design: browser hit testing is transform aware,
so the pointer must keep using raw viewport coordinates while the interface is scaled. Verified
against Chromium. A test pins the decision so the UI scale cannot later be wired into the hit
tester, which would break a case that currently works.
