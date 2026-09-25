# src/world

What Tongs tells a GM about the world itself, rather than about a roll.

| File                | What it is                                                               |
| ------------------- | ------------------------------------------------------------------------ |
| `worldSize.ts`      | Reading a size from ComeOnOverUno, and whether it is worth warning about |
| `startWorldSize.ts` | The setting, and the one question asked at launch                        |

## The browser cannot measure a world

Foundry serves no size for a world. A module could walk its file browser and ask the server for every
file, but that is hundreds of requests at launch on a big world, and it still misses the databases.
So ComeOnOverUno measures it, from the same volume Foundry runs on, and Tongs asks once.

⛔ That means the warning only works on a world **the server hosts**. On The Forge nothing can measure
it, and Tongs says nothing at all rather than guessing.

## Silence is the default everywhere it cannot answer

Not signed in, an older server, a world the server does not hold, a size in a shape it does not
recognise: every one of them means no warning. A GM launching a game is busy, and a courtesy that
interrupts them with a failure is worse than no courtesy at all.

Only the active full GM's browser asks, for the same reason every other automation names one browser:
a warning on each player's screen is noise about something only the GM can act on.

## What the warning says

The size, the number of files, the limit it passed, and which half is bigger, because what to do about
it differs. A world database that size is usually the chat log, which a GM can clear; assets are maps
and tokens they would have to delete. Asked for by Lewis, 2026-09-23, at 100 MB by default.
