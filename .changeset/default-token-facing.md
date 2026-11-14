---
'tongs-browser': minor
---

Default token facing. A new world setting, "Default token facing: mirror both ways, unlocked rotation", on by default and changed only by a GM, gives every new actor a prototype token mirrored horizontally and vertically with rotation unlocked, and places new tokens with such art at rotation 180 so they show upright and can still be turned to face a direction. An actor created with its own mirror keeps it. Existing actors change only when a GM asks: the "Apply to every actor" button in the module settings (it asks first and says how many changed), or `game.modules.get('tongs-browser').api.applyTokenFacingToAllActors()` from a GM's macro. Tokens already on a scene are not touched.

The Prototype Token window keeps its Mirror Image ticks when PF2e's auto-scale has locked the Scale slider. On PF2e 8.7 with Foundry 14.370 those ticks were silently dropped; Tongs now fills in the locked size so Foundry saves them, and does nothing once PF2e or Foundry fix it.
