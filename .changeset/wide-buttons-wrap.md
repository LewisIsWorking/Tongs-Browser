---
'tongs-browser': patch
---

Fix the modifier bar being wider than the phone it is built for.

On a 412px Android viewport the bar rendered 444px wide, leaving Esc, Enter and Tab entirely off
screen with no way to reach them, and no position could have helped because 444 does not fit into 412. The bar now wraps and is bounded by the viewport, keeping the 44px touch targets rather than
shrinking them. It is also clamped inside the viewport for the first time, so it can no longer be
dragged off screen or stranded by a rotation.

Found by `npm run check:android`, a new harness that drives Chrome on a real Android device over the
DevTools socket adb forwards, rather than a desktop browser pretending to be one.
