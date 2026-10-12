# src/maintenance

ComeOnOverUno's nightly Foundry update, seen from inside the world it is about to close.

| File                   | What it is                                                                    |
| ---------------------- | ----------------------------------------------------------------------------- |
| `maintenanceNotice.ts` | Reading COO's answer, and what this browser should do: nothing, warn or leave |
| `startMaintenance.ts`  | Asking COO, the countdown banner, and the move to the progress page           |

## Decided with Lewis, 2026-10-11

- **The update forces people off.** A world is nearly always open, so an update that waited for an empty
  server almost never ran. Lewis: "I'd rather we just force people off the world and give them a detailed
  progress UI". It runs at 06:00 UK time, when people are "even LESS likely to be online".
- **Five minutes' warning**, as a banner everyone in the world sees, counting down on the server's clock.
- **Then the progress page** (`/coo-updating`, served by COO): every step as it happens, and a way back
  when the same world is open again.

## Learnings

- ⭐ **On for everyone, no setting.** It only ever shows something while COO is about to close this very
  world. A setting to turn it off would only turn the bare "connection lost" screen back on.
- ⚠️ **Same-origin, anonymous.** COO's Caddy answers `/coo-api/foundry/maintenance` on Foundry's host, so it
  needs no COO sign-in and no CORS. A world COO does not host answers with Foundry's 404: no news.
- ⚠️ **A lost connection during the countdown means the world closed.** Waiting for the next poll would
  leave the player on Foundry's own error for up to five seconds, so it moves at once.
- ⚠️ **Another world is left alone.** COO names the world it is updating, and a stale tab on a different
  one must not be sent away.
