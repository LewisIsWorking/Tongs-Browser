---
'tongs-browser': patch
---

Harness: say why nothing is answering, instead of only that nothing is.

`requireActiveWorld` reported `nothing is answering on http://localhost:30000. Start Foundry and
launch a world.` for every kind of silence. On 2026-08-15 that sentence was true and sent the reader
somewhere useless twice: a stale `Config/options.json.lock` directory left by a server that exited
without unwinding, which makes the next launch die with "already locked by another process" about a
process that does not exist; and a perfectly healthy Foundry answering one port over on a separate
dataPath, which the message let read as "Foundry is down".

It now checks both and names them, with a third answer for a lock it could not check rather than
implying a clean check it never ran. Proven against the live fault, which found the real lock path
and the real neighbouring world unaided.

Also documents the 14.366 entry point rename (`main.mjs` to `main.js`), and `--noupnp`: `upnp`
defaults to true, so a world left up overnight collected join-page sessions from five external
addresses.
