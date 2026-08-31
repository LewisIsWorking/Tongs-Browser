---
'tongs-browser': patch
---

Test what the one sidebar button does in each shape of Foundry.

`decideSidebarAction` returns five kinds and only three were ever dispatched by a test: the decision
was covered and the carrying out was not. A phone has room for one button, so that button has to
serve several tabs, exactly one, none with a docked sidebar, and no sidebar at all.

A kind dispatched to the wrong branch is a button that does nothing in one configuration, and nobody
notices until somebody plays in that configuration. Mutation checked: each of the four branches kills
a different test.

Project coverage to 98.39 statements and 96.71 branches.
