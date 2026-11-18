---
'tongs-browser': minor
---

Default token vision. The default token facing setting, now "Default token facing: mirror both ways, unlocked rotation, vision on at 160 degrees", also turns vision on for every new token at a 160 degree cone. A token at Foundry's full 360 becomes 160; any other angle someone chose stays. Range is left to PF2e's rules-based vision. The "Apply to every actor" button (and `applyTokenFacingToAllActors()`) now gives every existing actor the vision too, and gives tokens already on a scene the vision only, never changing their look.
