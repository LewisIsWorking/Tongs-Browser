# src/ui

| File             | What it is                                            |
| ---------------- | ----------------------------------------------------- |
| `TrayActions.ts` | Which actions the modifier bar's tray offers, as data |

One file, kept apart from `src/modifiers` on purpose: the tray's **contents** are a list that changes
often, while the bar that renders them is machinery that changes rarely. Separating them means adding
an action does not touch the rendering, and the list is reviewable on its own.

## Each action names what pressing it will do

Grab and drop are separate entries rather than one toggle, because a control whose label does not
change cannot tell you which state it is in. On a tablet, where there is no hover and no cursor to
inspect, a control that looks identical in both states is a control whose effect is invisible until
you commit to it.
