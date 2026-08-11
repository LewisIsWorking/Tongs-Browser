---
'tongs-browser': minor
---

Add a sidebar button to the bar, so the sidebar is reachable on a phone.

Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
to chat, actors, journals and settings, so losing it costs most of the interface.

The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
exactly when the bar has been shrunk out of the way.

Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
keys and knows nothing about Foundry's interface.
