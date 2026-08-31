# Tongs Browser

## Open Source Maintenance Fee

This project requires an [Open Source Maintenance Fee](https://opensourcemaintenancefee.org/) from
organisations that use the **official binary release** as part of revenue-generating activity and
have annual gross revenue of **US$10,000 or more**.

- The **source stays free** under this repository's LICENSE. The fee is not a licence fee.
- **Self-compiled binaries are exempt.** You may always build from source under the LICENSE.
- Organisations under US$10,000 annual gross revenue are **exempt**.
- Individuals, hobbyists and personal use are **exempt**.
- Issues, discussions and pull requests stay **open to everyone**, fee or not.

Pay the fee via [GitHub Sponsors](https://github.com/sponsors/LewisIsWorking) at the
**Maintenance Fee** tier. Full terms: [OSMFEULA.txt](OSMFEULA.txt).

A Foundry VTT module that makes Foundry genuinely usable on an Android phone or tablet.

Foundry assumes a mouse. Touch devices do not have one, and the gap is wider than it first looks:

- **Hover states never fire.** Tooltips, token nameplates and the PF2e HUD panels all have no touch
  equivalent, so they are simply dead.
- **Small targets are guesswork**, because your fingertip covers the thing you are aiming at.
- **Modifier held actions are unreachable.** Shift drag to rotate, ctrl click to snap a template, alt
  to preview vision.

Tongs Browser fixes all three by synthesising a persistent virtual mouse pointer driven by your
finger, adding a sticky modifier key bar, and scaling the interface for small screens.

Status as of **2026-08-30**: **pre-release.** The module has been exercised against a live Foundry
**14.366** server, driving a real world through a headless browser: pointer movement, click, drag,
double click to open a sheet, and the sidebar. It has **not** been run on a physical Android device,
which is the gap that still matters most. See [docs/MANUAL-TESTING.md](docs/MANUAL-TESTING.md) for
what was measured and when.

## Installation

Paste this into Foundry's **Install Module** box:

```
https://github.com/LewisIsWorking/Tongs-Browser/releases/latest/download/module.json
```

Foundry re-reads that URL to decide whether an update exists, so it must be the release asset and not
the copy on `main`. The copy on `main` deliberately stays at the `0.1.0` placeholder, and pointing
users at it meant no install could ever see a new version. Corrected 2026-08-30.

Compatible with Foundry **v14**. The manifest declares 14.366, which is also the build the live
measurements were taken against.

## How it works

The pointer is a trackpad, not a touchscreen. Your finger moves the pointer; the pointer decides what
gets clicked. That indirection is the entire point: it is what lets hover states fire, and it means
your finger is never on top of the thing you are trying to hit.

## Gesture map

| Gesture                    | Action                                                                  |
| -------------------------- | ----------------------------------------------------------------------- |
| One finger drag            | Move the pointer                                                        |
| Tap                        | Left click **at the pointer**, not under your finger                    |
| Long press (500ms default) | Right click, with a short vibration                                     |
| Double tap                 | Double click                                                            |
| Tap, then press and hold   | Begin a left button drag. The cursor changes to show the button is held |
| Two finger drag            | Pan the map                                                             |
| Pinch                      | Zoom                                                                    |
| Modifier bar               | Latch Ctrl, Shift or Alt, or tap Space, Delete, Escape, Enter or Tab    |

Modifier keys are three state. Tap to latch for the next action, tap again to lock until released,
tap a third time to clear. The three states look different from each other, and not only by colour.

Text inputs, the chat log, the sidebar and any scrollable region are left alone entirely, so typing
and native scrolling work exactly as they did before.

## Settings

All settings are per client, so every player configures their own device.

| Setting               | Default  | Range              | What it does                                                                                                        |
| --------------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Enabled               | on       |                    | Master switch. Also on the scene controls as a one tap toggle                                                       |
| Pointer mode          | Trackpad | Trackpad or Offset | Trackpad moves relatively and suits a phone. Offset puts the pointer above your finger and suits a tablet           |
| Sensitivity           | 1.5      | 0.5 to 3.0         | How far the pointer travels per finger movement, trackpad mode only                                                 |
| Cursor size           | 28px     | 16 to 48           | Pointer diameter                                                                                                    |
| Offset distance       | 60px     | 0 to 120           | How far above your finger the pointer sits, offset mode only                                                        |
| Long press duration   | 500ms    | 300 to 1000        | How long to hold for a right click                                                                                  |
| Haptic feedback       | on       |                    | Vibrate on long press                                                                                               |
| Suppress native touch | on       |                    | Stop the browser sending its own touch events to Foundry. Turn off if you want another touch module to handle input |
| Show modifier bar     | on       |                    | Show the floating key bar                                                                                           |
| Interface scale       | 75%      | 50 to 100%         | Shrink the Foundry interface. Does not affect the map                                                               |
| Debug overlay         | off      |                    | Outline the element under the pointer and log every event                                                           |

## Relationship to TouchVTT

**Tongs Browser is complementary to TouchVTT, not a replacement for it.** They solve overlapping
problems in different ways, and which you want depends on how you play.

TouchVTT translates gestures directly into Foundry actions. It is excellent at what it does and does
not try to create a pointer, so hover states remain unavailable and modifier held actions remain out
of reach.

Tongs Browser creates a persistent pointer, which is what makes hover and modifiers work, at the cost
of a slightly more indirect feel: you move a pointer rather than touching the thing you want.

If you want both installed, turn **Suppress native touch** off in Tongs Browser. Both modules bind
the same touch events, and with suppression on, Tongs Browser stops the browser's own touch derived
events before TouchVTT sees them. With it off they can coexist, though you may find the two fighting
over the same gestures. Please report what you find.

## Known conflicts

Nothing confirmed yet. This section will be filled in from real testing rather than guesswork, and
anything found will be documented here rather than silently worked around.

Modules that bind `touchstart` on the document, or that render into the canvas container, are the
most likely candidates.

## Architecture

Decision records live in [docs/adr](docs/adr):

- [0001 Ship a module before a native shell](docs/adr/0001-module-before-native-shell.md)
- [0002 Native Android shell, phase 2](docs/adr/0002-native-android-shell.md)
- [0003 Synthesise both PointerEvent and MouseEvent](docs/adr/0003-pointerevent-vs-mouseevent.md)

0003 is the one to read first if you are picking this up after a Foundry version bump. It records
what was empirically verified about PIXI, hit testing and CSS transforms, including two places where
the original design assumptions turned out to be wrong.

## Development

Requires Node 22 or newer.

```
npm ci
npm run verify     # lint, typecheck, test, build
```

Individual steps: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
Use `npm run dev` for a watching build while working against a live Foundry instance.

See [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md) for wiring a checkout into a local Foundry with a
symlink, which removes the build, zip and reinstall cycle entirely, and for attaching an Android
device over USB to read its console.

The test suite splits into two projects on purpose. The `unit` project runs in plain node with no DOM
at all, which structurally enforces that the event sequence builders and the gesture state machine
stay pure: if one reaches for `document`, its test fails immediately rather than passing quietly. The
`dom` project covers dispatch ordering, hover transitions and exclusion zones under jsdom.

### Coverage

**The target is 100%.** `npm run verify` runs coverage and fails below the thresholds in
`vitest.config.ts`, which are a ratchet: Vitest rewrites them upward whenever coverage improves, so a
gain cannot be given back. As of 2026-08-30 the mark is 95.66% of statements and 93.21% of functions.

Coverage was measured but never enforced before that date. `test:coverage` existed and neither
`verify` nor CI ran it, so the figure appeared only when somebody typed the command by hand.

⚠️ **A percentage is a floor on what was EXECUTED, never evidence that anything was ASSERTED.** A test
written to move the number, with no expected value in it, raises coverage and proves nothing. This
repo has found exactly that by mutation testing, which is the only check that tells the two apart.
Reaching 100% by writing tests that assert nothing would be worse than staying at 95%, because it
would also remove the signal that anything is missing.

### Testing on Android

The gesture layer's whole reason to exist is a real touchscreen, so desktop passing is not the phone
passing. `npm run check:android` drives Chrome on a real device or emulator over the DevTools socket
`adb` forwards, against a live Foundry world.

```
adb forward tcp:9222 localabstract:chrome_devtools_remote
FOUNDRY_URL=http://10.0.2.2:30000 npm run check:android
```

`FOUNDRY_URL` is how the DEVICE reaches the host, which is `10.0.2.2` on an emulator rather than
`localhost`. See [docs/MANUAL-TESTING.md](docs/MANUAL-TESTING.md) for the checks that need a human
rather than a harness, and [docs/RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md) for how device
testing gates a package submission.

⚠️ Use a `google_apis` emulator image rather than `google_apis_playstore`. A Play Store image cannot
be rooted, so Chrome's first-run cannot be skipped with `--disable-fre` and the DevTools socket never
opens until somebody clicks through the setup by hand.

⚠️ **Cold boot the emulator before a run you intend to record.** Measured 2026-08-31: a warm emulator
that had been up for hours failed the tap-at-the-pointer check four times running, on two builds
including one that had passed the previous day. A cold boot passed twice with nothing else changed.
A warm emulator manufactures a false failure on the module's most important check, which is the kind
of red that gets a correct module "fixed".

```
emulator -avd coo_phone -no-snapshot-load -no-boot-anim
```

⚠️ **If the device gets `ERR_EMPTY_RESPONSE` while the host serves the same URL fine, suspect a
second listener on the port rather than the network.** Measured 2026-08-30: Foundry held
`0.0.0.0:30000` and an unrelated `cef_server` process held `127.0.0.1:30000`. Windows routes the more
specific binding, so the host's `localhost` resolved to `::1` and reached Foundry, while the device's
`10.0.2.2` **and** `adb reverse` both landed on IPv4 loopback and hit the other process, which
accepted the connection and sent nothing.

`netstat -ano | grep :30000` shows both. The fix needs no process killed: point the device at the
host's LAN address, which reaches the `0.0.0.0` binding directly.

```
FOUNDRY_URL=http://192.168.1.251:30000 npm run check:android
```

Something answering on the port is not the same as the RIGHT thing answering.

### Releases

Versioning runs on [Changesets](https://github.com/changesets/changesets). Every pull request that
changes behaviour should include one:

```
npm run changeset
```

Merging to `main` opens a "Version Packages" pull request that bumps the version and writes
`CHANGELOG.md`. Merging that creates a `v*` tag, which triggers CI to build `module.zip`, stamp the
matching version and download URL into `module.json`, and publish a GitHub release.

## License

MIT. See [LICENSE](LICENSE).
