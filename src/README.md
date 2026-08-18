# src

The module itself. Everything shipped in `dist/tongs-browser.js` comes from here.

| File                     | What it is                                                  |
| ------------------------ | ----------------------------------------------------------- |
| `main.ts`                | The entry point Foundry loads, and the `init`/`ready` hooks |
| `TongsBrowser.ts`        | The module object: enable, disable, expose the API          |
| `TongsBrowserOptions.ts` | What a caller may configure                                 |
| `ModuleParts.ts`         | Building the parts and handing them their dependencies      |
| `BuildModifierBar.ts`    | Assembling the bar from `src/modifiers`                     |
| `TrayWiring.ts`          | Connecting tray actions to the things they do               |
| `PointerStack.ts`        | The gesture layer and the pointer, joined up                |
| `constants.ts`           | The handful of values more than one folder needs            |

## Folders, by what they answer

| Folder          | Question                                    |
| --------------- | ------------------------------------------- |
| `gesture/`      | What did the user mean?                     |
| `pointer/`      | Make Foundry believe a mouse did it         |
| `modifiers/`    | The floating bar and sticky keys            |
| `foundry/`      | Everything that reaches into Foundry        |
| `debug/`        | What did Foundry actually do?               |
| `settings/`     | Foundry's settings and the scene control    |
| `scaling/`      | Making the interface usable at arm's length |
| `core/`         | Logging and haptics                         |
| `ui/`, `relay/` | Tray contents; other people's pause         |

## The composition root is separate from the parts

`ModuleParts.ts` is where dependencies are chosen and wired. Nothing below it constructs its own
collaborators, which is what lets the gesture machine be pure and the sequences be tested without a
browser.

⚠️ The failure this arrangement invites, and which has happened twice: extracting a part, giving it
tests, and never wiring it in. The composition root keeps its own duplicate, only one of the two has
tests, and both look fine. `npm run check:support` exists because of it. An extraction is finished
when nothing else does the job, not when the new file exists.

## Two lines say whether it worked

```
Tongs Browser | Initialising Tongs Browser (tongs-browser).
Tongs Browser | Ready. Keyboard strategy: events.
```

The second is the answer to the question the modifier bar depends on. `events` on 14.365 and 14.366.

## The rules

Every file here is under **200 lines**, enforced by `npm run check:sizes` with no backlog and no
exceptions for `src/`. TypeScript only. Every folder carries a README that names its own files,
enforced by `npm run check:readmes`.
