---
'tongs-browser': minor
---

Make the sidebar button actually produce a sidebar, and add a pause button.

The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
`expanded` flipped a real flag and changed nothing anyone could see.

The button now pops the active sidebar tab out as an ordinary application window. Measured on the
same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
than by luck. It falls back to the docked toggle on any build without the popout API.

Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
otherwise.

⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
so the check is on the emit path rather than on macro permissions. A player running any macro toggles
their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
work.
