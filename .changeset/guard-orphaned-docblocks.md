---
'tongs-browser': patch
---

Add `lint:docblocks`, a guard for comments that document nothing, and clear the last three.
`TongsBrowser.ts` 970 to 944.

**A comment is anchored to the declaration BELOW it.** Move that declaration during a refactor and
the comment does not move with it: it silently re-anchors to whatever is next and goes on reading as
documentation of a field it has nothing to do with. Worse, if the extraction did not carry the
reasoning across, the orphan is the ONLY copy and the next person to tidy it deletes it.

Found by hand after eight blocks had accumulated in `TongsBrowser` across today's extractions. The
guard fires on an indented docblock immediately followed by another, which is the signature.

Three things worth recording about building it:

- **The self test failed on the first run**, correctly. A file level docblock closes with ONE space
  of indent and a block inside a class body with three, so matching a single space flagged every file
  header in the repo followed by its first export. That is the ordinary and correct shape, and the
  guard would have had to be turned off rather than trusted.
- **The first real run caught an orphan created ten minutes earlier**, by this same change, when a
  rescued block was placed above a method that already had one.
- **That block was not unique after all.** The check for "does this content exist elsewhere" used an
  exact phrase, `leak them into`, and the existing copy said `leak them across`. An exact phrase grep
  cannot detect a reworded duplicate, and only the guard found it.
