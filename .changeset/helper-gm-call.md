---
'tongs-browser': minor
---

No GM online: when a player asks for a character sheet, or a hit or spell is queued, Tongs now asks ComeOnOverUno to send its helper GM, which opens the world and does the work so nobody has to wait for a GM to log in. The helper reads the queued work through `game.modules.get('tongs-browser').helper.waiting()`.
