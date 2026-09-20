---
'tongs-browser': minor
---

Answer ComeOnOverUno world-swap requests from the GM's browser.

One server runs one Foundry world at a time, so a player pressing Play for a campaign in another world has to
take the server. ComeOnOverUno asks a connected GM first, and until now
nothing told it a GM was connected, so every swap took the "no GM connected" path and simply happened.

The active full GM's browser now beats every 30 seconds to say which world it is in, and the same call brings
back anything waiting: one dialog per request naming the player and the world, and either answer is sent back
to ComeOnOverUno. A decision that does not reach the server is offered again rather than lost.

On by default, because off is the setting that lets a swap close the world your table is playing in without
asking. Nothing is sent until the GM signs this browser in to ComeOnOverUno.
