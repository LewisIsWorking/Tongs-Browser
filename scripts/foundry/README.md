# scripts/foundry

Getting a browser into a live Foundry world, and saying clearly when that is not possible. Everything
here is shared by the nine `check:` and `probe:` scripts through `scripts/foundry-session.ts`, so a
bug fixed once is fixed for all of them.

| File               | What it is                                                                      |
| ------------------ | ------------------------------------------------------------------------------- |
| `browsers.ts`      | Launching Chromium, or attaching to Chrome on a phone over adb                  |
| `serverStatus.ts`  | Is a world launched and ready, rather than merely a port answering              |
| `serverAbsence.ts` | Why nothing is answering, said in terms you can act on                          |
| `serverProbe.ts`   | Gathering the facts `serverAbsence` explains: stale locks, neighbouring servers |
| `joinUsers.ts`     | Turning a user's name into the id `/join` wants                                 |
| `joinReply.ts`     | Reading what `/join` answered, including when it is not JSON                    |
| `scenes.ts`        | Creating and removing the `[probe]` scene a check needs                         |
| `geometry.ts`      | Board boxes and centres, in client coordinates                                  |

## The rules that are load-bearing

**Two addresses, not one.** `HOST_BASE` is what this Node process can reach; `BASE` is what the
_browser_ can reach. On desktop they are the same string, which is exactly why one constant seemed
enough. Driving Chrome on an Android emulator makes them necessarily different: the emulator reaches
the host only through `10.0.2.2`, which the host cannot resolve at all.

**Join by POSTing, not by driving the form.** Foundry disables the entry for a user who is already
connected, so the form path fails precisely when someone has the world open.

**Wait on `game.ready`, not on a selector.** The UI paints well before the world is usable, and
asserting against a half initialised game reports races as failures.

**Split "bytes arrived" from "bytes usable".** A refused join answers with a bare localization key,
so parsing it as JSON throws and takes the server's actual complaint with it. `joinReply.ts` exists
because of that.

## Failures that accuse the wrong thing

The recurring bug in this folder is a diagnostic that blames the module for the harness's own
problem. Two are fixed and worth knowing about:

- **`userId`, not `userid`.** Foundry 14.366 changed the join payload key by one character. The old
  key is not rejected, it is _ignored_, so the server sees a request with no user and answers
  `JOIN.ErrorUserDoesNotExist` about a user who is plainly there. `joinUsers.ts` sends both spellings
  so the harness works either side of an upgrade.
- **"nothing is answering" is the start of a diagnosis, not the end.** `serverAbsence.ts` also names a
  stale `Config/options.json.lock` (which makes the next launch die about a process that no longer
  exists) and any Foundry answering on a neighbouring port. Both were real, both cost a round trip.

## Running anything here

Needs a launched world and `FOUNDRY_PASSWORD` set. Flags go through `node`, not `npm run ... --`:
npm 12 parses unknown flags itself even after the separator.

```
node scripts/foundry-drag-check.ts --hold=700
```
