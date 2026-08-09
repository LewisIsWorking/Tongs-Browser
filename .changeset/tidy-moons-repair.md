---
'tongs-browser': patch
---

Fix the release pipeline so module.zip is actually attached to the release.

A tag pushed using GITHUB_TOKEN does not trigger any workflow, which GitHub blocks deliberately to
prevent recursive runs. The previous pipeline relied on a tag trigger to build and attach the
release asset, so v0.2.0 was published with no module.zip and the manifest download URL returned
404, leaving the module uninstallable.

Packaging now happens in the same job that creates the tag. A manual workflow dispatch is also
available for attaching the asset to a tag that already exists.
