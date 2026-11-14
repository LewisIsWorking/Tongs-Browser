---
'tongs-browser': minor
---

The loading screen now shows how far the world has got and roughly how long is left, in the same words as the portal's world launch: "Preparing characters and items: 42%, about 1 min left". The bar fills instead of sliding, and keeps moving even while Foundry holds the page. Each browser remembers how long each stage took on its last few loads of each world (in local storage, the newest five per stage), so the first load of a world shows only the percentage and later loads add the time left; a load running past its usual length says "taking longer than usual" instead. While the map's pictures load, the bar follows Foundry's own progress for them. The world's name now shows in the title too: it always read "Opening Foundry" before.
