---
'tongs-browser': patch
---

The play probe never opened the sidebar, and could not be split until now.

"Create an actor from the sidebar" had been reporting AIM with "create button blocked by the element
does not exist" against a live 14.366. The button exists and still carries `data-action="createEntry"`;
what it lacks is a centre inside the viewport, because `ui.sidebar.expanded` is false after
`game.ready` and `changeTab` does not open it. Measured with `hasTouch` both false and true, so it is
the collapse rather than the touch surface. It now expands the drawer, and the capability passes end
to end through the pointer on a real world: AIM to YES.

The file was 572 lines because `page.evaluate` serialises its callback, so every helper had to be
defined inside the one function that used it. `page.addInitScript` serialises the same way but
installs onto `window` before the page's scripts run and survives the navigations joining performs,
so the pieces are now seven modules meeting at one namespace, the largest 200 lines and the entry
point 107. Proven by running the probe against a live world, not by typechecking.

Two smaller fixes found while doing it:

- The size guard printed a remedy that cannot be executed. npm 12 parses unknown flags itself even
  after `--`, so `npm run check:sizes -- --update` dies with `Invalid abbreviated flag "--update"`.
  It now prints the `node scripts/...` form that works. The same npm behaviour eats `--hold=` on
  `check:drag`.
- `findNeighbourServers` takes its port list as an argument. It always probes Foundry's default
  30000, so the test asserting "reports nothing when nothing is listening" passed only while no
  Foundry was running, and failed the moment one started. It was measuring the machine.
