# tongs-browser

## 0.11.0

### Minor Changes

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report the build version and the actual event stream in diagnostics.

  A drag failure on a real device produced a report where **every static check was healthy**: `select`
  tool, `_canDrag: true`, pointer genuinely inside the selected token, canvas ready. At that point the
  setup is not the problem and the only thing left to look at is the event stream itself, which on a
  phone has no console to look at it in. The report now carries the last eighteen dispatched events
  with their `buttons` value, which is the field that decides whether a drag is a drag: it must stay
  non zero on every move between the down and the up, or Foundry reads the stream as a hover.

  ⚠️ The same report also claimed version 0.2.3 while running code from 0.9.0, and that is worth
  fixing rather than explaining away. `game.modules.get(id).version` comes from a manifest Foundry
  reads **once at server start** and caches, so replacing module files under a running server leaves it
  frozen at whatever booted. The version is now stamped into the bundle at build time and both are
  shown, so a mismatch is visible rather than misleading.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

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

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

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

### Patch Changes

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix dragging failing whenever the pointer crosses any other element.

  Reported from a device and finally named by the diagnostics report: `pointermove buttons=1 -> div#`,
  where it needed to reach `canvas#board`. Every drag event was hit tested afresh, so the instant the
  pointer crossed anything at all, a chat window, the modifier bar, a character sheet, the drag was
  delivered **there** and the canvas simply stopped hearing about it. The token stopped following and
  nothing reported an error.

  A browser does not work that way: `pointerdown` implicitly **captures** the pointer to the element
  that received it, and every later move and the release go to that same element however far the
  pointer travels. The pointer now does the same.

  ⚠️ It never appeared on desktop because a drag across empty canvas never crosses anything, and the
  existing test asserted the wrong behaviour outright, being named "resolves the target afresh on each
  drag step rather than caching it". The reasoning behind that was sound and is preserved: Foundry
  re-renders applications mid interaction, so a captured element can be detached and dispatching at a
  detached element throws the event away silently. The mistake was treating "it might be detached" as a
  reason to re-resolve always rather than only when it actually is.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.10.0

### Minor Changes

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report the build version and the actual event stream in diagnostics.

  A drag failure on a real device produced a report where **every static check was healthy**: `select`
  tool, `_canDrag: true`, pointer genuinely inside the selected token, canvas ready. At that point the
  setup is not the problem and the only thing left to look at is the event stream itself, which on a
  phone has no console to look at it in. The report now carries the last eighteen dispatched events
  with their `buttons` value, which is the field that decides whether a drag is a drag: it must stay
  non zero on every move between the down and the up, or Foundry reads the stream as a hover.

  ⚠️ The same report also claimed version 0.2.3 while running code from 0.9.0, and that is worth
  fixing rather than explaining away. `game.modules.get(id).version` comes from a manifest Foundry
  reads **once at server start** and caches, so replacing module files under a running server leaves it
  frozen at whatever booted. The version is now stamped into the bundle at build time and both are
  shown, so a mismatch is visible rather than misleading.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

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

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

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

### Patch Changes

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.9.0

### Minor Changes

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

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

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

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

### Patch Changes

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.8.0

### Minor Changes

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

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

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

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

### Patch Changes

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.7.0

### Minor Changes

- [#31](https://github.com/LewisIsWorking/Tongs-Browser/pull/31) [`a67ae01`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a67ae018bf3d6cef9545b451fcefc23f468bedb3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#31](https://github.com/LewisIsWorking/Tongs-Browser/pull/31) [`a67ae01`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a67ae018bf3d6cef9545b451fcefc23f468bedb3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#31](https://github.com/LewisIsWorking/Tongs-Browser/pull/31) [`a67ae01`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a67ae018bf3d6cef9545b451fcefc23f468bedb3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#31](https://github.com/LewisIsWorking/Tongs-Browser/pull/31) [`a67ae01`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a67ae018bf3d6cef9545b451fcefc23f468bedb3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

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

- [#31](https://github.com/LewisIsWorking/Tongs-Browser/pull/31) [`a67ae01`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a67ae018bf3d6cef9545b451fcefc23f468bedb3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

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

### Patch Changes

- [#31](https://github.com/LewisIsWorking/Tongs-Browser/pull/31) [`a67ae01`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a67ae018bf3d6cef9545b451fcefc23f468bedb3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

## 0.6.0

### Minor Changes

- [#29](https://github.com/LewisIsWorking/Tongs-Browser/pull/29) [`ba49aa8`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ba49aa883420d6abc4b47b3c92a6e1695d3f4c88) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#29](https://github.com/LewisIsWorking/Tongs-Browser/pull/29) [`ba49aa8`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ba49aa883420d6abc4b47b3c92a6e1695d3f4c88) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#29](https://github.com/LewisIsWorking/Tongs-Browser/pull/29) [`ba49aa8`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ba49aa883420d6abc4b47b3c92a6e1695d3f4c88) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

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

- [#29](https://github.com/LewisIsWorking/Tongs-Browser/pull/29) [`ba49aa8`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ba49aa883420d6abc4b47b3c92a6e1695d3f4c88) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

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

### Patch Changes

- [#29](https://github.com/LewisIsWorking/Tongs-Browser/pull/29) [`ba49aa8`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ba49aa883420d6abc4b47b3c92a6e1695d3f4c88) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

## 0.5.0

### Minor Changes

- [#27](https://github.com/LewisIsWorking/Tongs-Browser/pull/27) [`6fd42d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6fd42d19303a494485cc4a4989ace7460dada383) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#27](https://github.com/LewisIsWorking/Tongs-Browser/pull/27) [`6fd42d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6fd42d19303a494485cc4a4989ace7460dada383) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

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

- [#27](https://github.com/LewisIsWorking/Tongs-Browser/pull/27) [`6fd42d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6fd42d19303a494485cc4a4989ace7460dada383) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

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

### Patch Changes

- [#27](https://github.com/LewisIsWorking/Tongs-Browser/pull/27) [`6fd42d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6fd42d19303a494485cc4a4989ace7460dada383) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

## 0.4.0

### Minor Changes

- [#25](https://github.com/LewisIsWorking/Tongs-Browser/pull/25) [`ad62197`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ad62197dd59d41f0796c8cedb956f3153cc7169c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#25](https://github.com/LewisIsWorking/Tongs-Browser/pull/25) [`ad62197`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ad62197dd59d41f0796c8cedb956f3153cc7169c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

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

### Patch Changes

- [#25](https://github.com/LewisIsWorking/Tongs-Browser/pull/25) [`ad62197`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ad62197dd59d41f0796c8cedb956f3153cc7169c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

## 0.3.0

### Minor Changes

- [#23](https://github.com/LewisIsWorking/Tongs-Browser/pull/23) [`fa93882`](https://github.com/LewisIsWorking/Tongs-Browser/commit/fa93882a64d69b228a4ea18d67a93af4be170ba6) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

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

### Patch Changes

- [#23](https://github.com/LewisIsWorking/Tongs-Browser/pull/23) [`fa93882`](https://github.com/LewisIsWorking/Tongs-Browser/commit/fa93882a64d69b228a4ea18d67a93af4be170ba6) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

## 0.2.4

### Patch Changes

- [#21](https://github.com/LewisIsWorking/Tongs-Browser/pull/21) [`bbdfa46`](https://github.com/LewisIsWorking/Tongs-Browser/commit/bbdfa469e130bbda4d71ae8858a09ecebf6aec49) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

## 0.2.3

### Patch Changes

- [#18](https://github.com/LewisIsWorking/Tongs-Browser/pull/18) [`1481d59`](https://github.com/LewisIsWorking/Tongs-Browser/commit/1481d598d42c090a94905f3fcfe687b8db7fcd8c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix the modifier bar being wider than the phone it is built for.

  On a 412px Android viewport the bar rendered 444px wide, leaving Esc, Enter and Tab entirely off
  screen with no way to reach them, and no position could have helped because 444 does not fit into 412. The bar now wraps and is bounded by the viewport, keeping the 44px touch targets rather than
  shrinking them. It is also clamped inside the viewport for the first time, so it can no longer be
  dragged off screen or stranded by a rotation.

  Found by `npm run check:android`, a new harness that drives Chrome on a real Android device over the
  DevTools socket adb forwards, rather than a desktop browser pretending to be one.

## 0.2.2

### Patch Changes

- [#17](https://github.com/LewisIsWorking/Tongs-Browser/pull/17) [`c2824fc`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c2824fc2fbecdf25f7ca90792f6412693f66c4d8) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the scene control toggle exist, and be reachable.

  The one control that has to work when the pointer is misbehaving did not exist at all on Foundry 14,
  for two independent reasons. The `getSceneControlButtons` hook was bound at `ready`, but Foundry
  builds the scene controls exactly once before that, so the listener fired zero times even after a
  forced re-render; it now binds at `init`. And the group is called `tokens` on v14 while the code
  looked for `token`, with a fallback that would have put the button silently into `regions`, which is
  worse than not appearing. The fallback is gone: it returns null rather than guessing.

  With the toggle finally rendering, the module's own modifier bar covered it. The scene control
  toolbar occupies x 12 to 66, and the bar defaulted to x 16, so the toggle at x 42 to 66 sat entirely
  underneath it and `elementFromPoint` returned the bar's collapse button. The default moved to x 88.

  Also adds `.chat-log` to the exclusion zones. `#chat-log` matched nothing on 14.365, since the log is
  a class there and the id is v12 markup; the behaviour had survived only because `.chat-scroll` wraps
  it. ADR 0008.

- [#14](https://github.com/LewisIsWorking/Tongs-Browser/pull/14) [`5f14d19`](https://github.com/LewisIsWorking/Tongs-Browser/commit/5f14d196ef002205aab46ac72f28f3a919866071) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Exercise the gesture machine with real, trusted touch input.

  `npm run check:touch` injects touch through Chrome DevTools Protocol, so the events carry
  `isTrusted: true` and the browser emits its own compatibility pointer and mouse events alongside them
  exactly as a tablet does. That last part cannot be reproduced by a hand built `TouchEvent`, and it is
  precisely what the native touch suppressor exists to handle.

  Five checks, all passing on 14.365. The important one is that a tap clicks at the pointer rather than
  under the finger: the pointer is parked on a sidebar tab, the finger taps far away over the canvas,
  and the tab changes. Recorded in ADR 0006, which closes the touch gap ADR 0005 left open. Multi touch
  is still uncovered.

- [#16](https://github.com/LewisIsWorking/Tongs-Browser/pull/16) [`f78f326`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f78f32633d806995bb9ad50449f0eb5d9271c78f) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix the first pinch of every session jumping the canvas.

  `CanvasController` kept its own scale, seeded to 1, and corrected it through a `syncScale` method
  that nothing ever called. Foundry fits a scene to the viewport on load, so the canvas almost never
  starts at 1, and `canvas.pan({ scale })` is an absolute setter. Measured against a real Foundry: a
  scene sitting at 0.5 took a 1.6x pinch and landed on 1.6 rather than 0.8, a 3.2x lurch. The error is
  exactly 1/initialScale, so it was worst on the large scenes a tablet user is most likely to pinch.
  It also fired whenever anything else changed the zoom, including Foundry's own controls.

  The live scale is now read from the canvas on every zoom, and supplying it is a required option
  rather than an optional one, since an optional callback is exactly what a call site can forget.
  ADR 0007.

  Also adds `npm run check:multitouch`, the two finger harness that found it. It asserts the ratio
  between before and after rather than an absolute scale, because an absolute assertion would have
  passed while the canvas jumped.

- [#11](https://github.com/LewisIsWorking/Tongs-Browser/pull/11) [`01da078`](https://github.com/LewisIsWorking/Tongs-Browser/commit/01da07820b761e9957ebacb2ae7ae2918f22da93) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add browser tests against real Chromium, covering what jsdom structurally cannot.

  jsdom has no layout engine, so it cannot answer the questions carrying the most risk in this
  module: whether the cursor overlay stays out of its own hit tests, whether hover resolves the
  element the cursor is visually over, and whether either survives a CSS transform. Those are checked
  against the built bundle in a real browser now, rather than being discovered on a tablet.

  The suite empirically confirms the decision recorded in ADR 0003: clicks land on the correct
  element at 100, 75 and 50 percent interface scale with no coordinate conversion applied. It also
  confirms that the event view is set in a real browser, which the jsdom tests could not exercise at
  all.

- [#12](https://github.com/LewisIsWorking/Tongs-Browser/pull/12) [`8f8df7c`](https://github.com/LewisIsWorking/Tongs-Browser/commit/8f8df7c147bdc3937636874886b1630205d98375) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a local development setup guide.

  Covers wiring a checkout into a local Foundry with a symlink, which reduces the test loop from
  build, zip, release and reinstall down to save and reload, plus attaching an Android device over USB
  so its console can be read from desktop Chrome.

- [#13](https://github.com/LewisIsWorking/Tongs-Browser/pull/13) [`839098a`](https://github.com/LewisIsWorking/Tongs-Browser/commit/839098a35f40b91c2eb5c17614bcfcb376e6d924) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Answer the keyboard strategy question, and make a clean Windows clone verify.

  `npm run probe:foundry` drives a headless browser into a running Foundry, enables the module and
  measures whether synthesised keyboard events are honoured, taking its own independent reading rather
  than trusting the module's self report. On 14.365 the answer is `events`, so the modifier bar works
  as designed and the internals-touching fallback is dead code. Recorded in ADR 0004.

  Also adds `.gitattributes` with `* text=auto eol=lf`. Without it a Windows clone checks out CRLF,
  Prettier is pinned to LF, and `npm run verify` failed on a clean clone with all 76 files reported as
  badly formatted. CI runs on Linux and could never see it.

- [#13](https://github.com/LewisIsWorking/Tongs-Browser/pull/13) [`839098a`](https://github.com/LewisIsWorking/Tongs-Browser/commit/839098a35f40b91c2eb5c17614bcfcb376e6d924) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Verify both Foundry interaction surfaces accept the virtual pointer.

  `npm run check:foundry` drives a real Foundry and asserts against Foundry's own state rather than
  against appearances: a synthesised click is judged by `ui.sidebar.tabGroups`, and a synthesised
  pointer move by `canvas.mousePosition`. Both pass on 14.365, which measures the central risk ADR 0003
  was written to manage. Recorded in ADR 0005.

  The session handling shared by both Foundry tools is extracted into `scripts/foundry-session.mjs`,
  since a second copy of a login is a second thing to get subtly wrong in a way that hangs rather than
  errors.

## 0.2.1

### Patch Changes

- [#9](https://github.com/LewisIsWorking/Tongs-Browser/pull/9) [`0811faa`](https://github.com/LewisIsWorking/Tongs-Browser/commit/0811faa90f12db75628e50e9e3600f11f093a89e) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix the release pipeline so module.zip is actually attached to the release.

  A tag pushed using GITHUB_TOKEN does not trigger any workflow, which GitHub blocks deliberately to
  prevent recursive runs. The previous pipeline relied on a tag trigger to build and attach the
  release asset, so v0.2.0 was published with no module.zip and the manifest download URL returned
  404, leaving the module uninstallable.

  Packaging now happens in the same job that creates the tag. A manual workflow dispatch is also
  available for attaching the asset to a tag that already exists.

## 0.2.0

### Minor Changes

- [#5](https://github.com/LewisIsWorking/Tongs-Browser/pull/5) [`cf6dfd4`](https://github.com/LewisIsWorking/Tongs-Browser/commit/cf6dfd4d1b48d568642a66f2a633d90e85aa0633) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add interface scaling and application window clamping.

  Foundry's HTML chrome is scaled by a single CSS custom property, between 50 and 100 percent in five
  percent steps, with each region anchored to the edge it is pinned to. The canvas is never scaled.
  Application windows are clamped into the viewport for both the legacy and ApplicationV2 systems,
  since a sheet opening off screen on a touch device takes its close button with it and cannot be
  recovered.

  Also corrects a premise carried from the original design: browser hit testing is transform aware,
  so the pointer must keep using raw viewport coordinates while the interface is scaled. Verified
  against Chromium. A test pins the decision so the UI scale cannot later be wired into the hit
  tester, which would break a case that currently works.

- [#3](https://github.com/LewisIsWorking/Tongs-Browser/pull/3) [`686561e`](https://github.com/LewisIsWorking/Tongs-Browser/commit/686561e52f3b1934dc4648a308da673563a2efd0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the gesture layer and wire the module up so it runs.

  A finite state machine with explicit named states translates touches into pointer actions: tap to
  click at the pointer rather than at the finger, long press to right click, double tap, tap then hold
  to begin a drag, two finger pan, and pinch to zoom. The machine is pure, taking timestamps as input
  and requesting timers as actions, so every transition is tested without a DOM or a clock.

  Text inputs, contenteditable regions, the chat log and the sidebar are excluded, so typing and
  native scrolling keep working. Real touch derived pointer events are suppressed at the capture
  phase, behind its own toggle since that is the most likely source of conflict with another module.

- [#1](https://github.com/LewisIsWorking/Tongs-Browser/pull/1) [`b83c47f`](https://github.com/LewisIsWorking/Tongs-Browser/commit/b83c47fa297acb597ac4475214175e8f62ecf1d4) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the project scaffold: TypeScript 6 in strict mode, Vite library build producing
  `dist/tongs-browser.js` and `dist/tongs-browser.css`, Vitest split into a DOM free unit project and
  a jsdom project, ESLint with type aware rules, Prettier, an em dash check covering every tracked
  file, the Foundry manifest, hand written Foundry ambient types, and CI covering lint, typecheck,
  test, build and tagged releases.

- [#4](https://github.com/LewisIsWorking/Tongs-Browser/pull/4) [`5ed5eeb`](https://github.com/LewisIsWorking/Tongs-Browser/commit/5ed5eeb60dc5d62bd75988705fe4f5b35788f3ad) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the sticky modifier key bar.

  A floating, draggable, collapsible bar offering Ctrl, Shift, Alt, Space, Delete, Escape, Enter and
  Tab. Modifiers latch on tap, lock on a second tap, and release on a third. Latched keys clear after
  one action while locked ones stay held. Events are dispatched by `code`, which is what Foundry's
  keybinding system matches on.

  Includes a startup probe that measures whether this Foundry build honours synthesised keyboard
  events, falling back to writing the keyboard manager's held key set directly, with a warning, when
  it does not.

- [#2](https://github.com/LewisIsWorking/Tongs-Browser/pull/2) [`f25481a`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f25481a7e842f9564fcaab4a43778b7497860343) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the pointer core: the event synthesis engine behind the virtual mouse.

  Event sequences are pure functions returning ordered descriptors, dispatched by a separate thin
  dispatcher, so the ordering logic is tested in plain node with no DOM. Covers hover transitions on
  target change, left and right click, double click, dragging with the buttons bitmask held across
  the move stream, and pixel mode wheel events. Both PointerEvent and legacy MouseEvent are emitted.

  Includes the coordinate transform that converts between drawn and hit tested space, without which
  clicks land somewhere other than where the cursor appears once the interface is scaled.

- [#6](https://github.com/LewisIsWorking/Tongs-Browser/pull/6) [`984c090`](https://github.com/LewisIsWorking/Tongs-Browser/commit/984c0902b9698c4fb3f4383541c6e0656597879a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add client settings and a scene control toggle.

  All eleven settings from the design are registered as client scope, so each player configures their
  own device, and every one applies live rather than needing a reload. Values are validated and
  clamped on read rather than cast, so a setting written by an older version or edited by hand cannot
  reach the gesture config as a NaN.

  The scene control button matters more than convenience suggests: if the pointer misbehaves mid
  session, reaching the settings dialog to disable it means using the pointer to do so.

  Also adds the debug overlay, which outlines the element the pointer currently resolves to and logs
  every synthesised event.

### Patch Changes

- [#7](https://github.com/LewisIsWorking/Tongs-Browser/pull/7) [`076f2d9`](https://github.com/LewisIsWorking/Tongs-Browser/commit/076f2d919aae85973a415e6a7ae5f5f5e802711c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the README, the architecture decision records and the manual testing checklist.

  ADR 0003 records what was empirically verified about PIXI, hit testing and CSS transforms, including
  the two places where the original design assumptions turned out to be wrong: Foundry runs PIXI v7
  rather than v8, and browser hit testing is transform aware so no coordinate conversion is needed.
