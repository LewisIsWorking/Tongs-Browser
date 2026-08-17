# Local development setup

The remaining work on this module is device work, and device work cannot be done from a cloud
container. This is how to get a local checkout wired into a running Foundry so that editing a file
and reloading the browser is the whole loop.

Nothing is lost by moving: everything is on GitHub, so a clone picks up exactly where the cloud
session left off.

## Why bother with a symlink

Without one, testing a change means building, zipping, cutting a release, and reinstalling in
Foundry. With one, Foundry reads the built output straight out of your working copy, so the loop is
save the file and press reload.

Foundry requires the directory name under `modules/` to match the `id` in `module.json`, which is
`tongs-browser`. Name the link exactly that or Foundry will ignore it.

## Clone and install

Requires Node 22 or newer.

```
git clone https://github.com/LewisIsWorking/Tongs-Browser.git
cd Tongs-Browser
npm ci
npm run build
```

Confirm the checkout is healthy before wiring anything up:

```
npm run verify
```

Lint, typecheck, the node and jsdom suites, and a build. If that passes you have exactly what the
cloud session had. (Counting the tests here was a mistake: the number said 281 long after it had
become 917, and a doc that states a figure nothing checks will eventually state a wrong one.)

## Link it into Foundry

Find your Foundry user data directory first. It is shown in Foundry's own Configuration tab, under
"User Data Path", and it is the folder containing `Data`, `Config` and `Logs`. The defaults are:

| Platform | Default user data path                     |
| -------- | ------------------------------------------ |
| Windows  | `%localappdata%\FoundryVTT`                |
| Linux    | `~/.local/share/FoundryVTT`                |
| macOS    | `~/Library/Application Support/FoundryVTT` |

### Windows

Run in an **elevated** Command Prompt, or enable Developer Mode first so symlinks work unprivileged.
Adjust the second path to wherever you cloned.

```
mklink /D "%localappdata%\FoundryVTT\Data\modules\tongs-browser" "C:\Users\Lewis\WebstormProjects\Tongs-Browser"
```

PowerShell equivalent:

```
New-Item -ItemType SymbolicLink `
  -Path "$env:LOCALAPPDATA\FoundryVTT\Data\modules\tongs-browser" `
  -Target "C:\Users\Lewis\WebstormProjects\Tongs-Browser"
```

### Linux and macOS

```
ln -s "$PWD" ~/.local/share/FoundryVTT/Data/modules/tongs-browser
```

## The development loop

```
npm run dev
```

Vite rebuilds `dist/` on every save. Reload the Foundry browser tab to pick up the change. No
release, no reinstall, no zip.

Foundry caches module files reasonably aggressively, so use a hard reload the first time.

## Verifying it loaded

Open the browser console. At startup the module logs two lines:

```
Tongs Browser | Initialising Tongs Browser (tongs-browser).
Tongs Browser | Ready. Keyboard strategy: <events|direct|unknown>.
```

**That second line is the answer to the biggest open question in the project.** It reports whether
this Foundry build honours synthesised keyboard events, which decides whether the modifier bar works
at all. Record it in `docs/MANUAL-TESTING.md`.

On Foundry 14.365 the answer is `events`, measured 2026-08-09. See
[ADR 0004](adr/0004-foundry-honours-synthetic-keyboard-events.md).

## Getting that answer without clicking

```
npm run probe:foundry
```

Drives a headless browser into a running world, enables the module if it is off, and prints the
strategy alongside an independent measurement of the same thing. Set `PLAYWRIGHT_CHANNEL=chrome` to
use the installed Chrome instead of a downloaded Chromium.

It needs a world already launched. The quickest way to get one, with no Electron window in the way:

```powershell
node "C:\Program Files\Foundry Virtual Tabletop\resources\app\main.js" `
  --dataPath="C:/Users/Lewis/AppData/Local/FoundryVTT" --world=<world-id> --noupnp
```

Launching a world runs any pending system data migration on it, so point that at a world you are
willing to migrate.

Two details, both learned the hard way on 2026-08-15:

**`main.js`, not `main.mjs`.** Foundry 14.366 renamed the entry point. The old path fails with a
module-not-found that says nothing about a version change.

**`--noupnp`, unless you want the world on the internet.** `upnp` defaults to true, so Foundry asks
your router to forward its port outward. A world left up overnight collected join-page sessions from
five external addresses. The flag suppresses it per run; unticking _Enable UPnP_ in
Setup → Configuration is the permanent fix.

### When it refuses to start and nothing is running

```
A fatal error occurred ...: Foundry VTT cannot start in this directory
which is already locked by another process.
```

Foundry claims its data directory by creating `Config/options.json.lock` as a **directory**, which
makes the claim atomic and also makes it survive a server that dies without unwinding. The message
names a process that no longer exists. Remove the directory and launch again:

```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\FoundryVTT\Config\options.json.lock"
```

Only when nothing is listening on the port. During a healthy run that directory is supposed to be
there. `requireActiveWorld` in the harness checks for this and says so, so any `check:` script will
tell you rather than leaving you to find it here.

## Running the browser tests locally

```
npx playwright install chromium
npm run test:browser
```

Fourteen tests against real Chromium, covering the hit testing behaviour jsdom cannot reach. They
run against `dist/`, so build first.

## Testing on the Android device

The symlink only helps a locally hosted Foundry. For the tablet there are two routes.

**Against your local Foundry.** Put the tablet on the same network and browse to your machine's LAN
address on Foundry's port, usually 30000. Fastest iteration, since it still uses the symlink.

**Against The Forge.** Install the released module through the manifest URL:

```
https://raw.githubusercontent.com/LewisIsWorking/Tongs-Browser/main/module.json
```

That requires cutting a release for each change, so prefer the local route while iterating and save
The Forge for confirming the real thing works.

### Seeing the tablet's console

Connect the tablet by USB with USB debugging enabled, then open `chrome://inspect` in desktop
Chrome. The tablet's Foundry tab appears there and gives you a full devtools session against it,
including the console output above. This is by far the most useful debugging tool for this module,
because most failures are silent.

## Things that only exist locally

Worth knowing what the cloud container could not do, since these are now available:

- `foundryvtt.com` is reachable, so package pages, API docs and release notes can be read directly.
- The `gh` CLI can be installed, which is what branch protection needs.
- A real Foundry instance exists to test against.
- The tablet can be attached over USB.
