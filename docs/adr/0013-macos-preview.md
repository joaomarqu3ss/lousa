# 0013 — macOS universal preview

The first macOS release is a public beta, distributed as a universal DMG for
Apple Silicon and Intel alongside the existing Windows and Linux installers.
It requires macOS 15 or later. macOS joins CI, including a universal bundle
build. The release workflow waits for the builds and automated tests of every
platform before publishing a prerelease; stable releases remain drafts.

The preview is not signed with a Developer ID or notarized. Its release notes
link to Apple's instructions for opening apps from unidentified developers.
Before tagging the beta, manually validate the existing document, export,
settings, and Agent Bridge workflows on macOS. The initial validation uses
Apple Silicon with macOS 27; macOS 15 and Intel hardware are not yet tested
and that limitation must be stated in the release notes. Any known failure of
an existing feature on macOS blocks publication.

This extends the platform and distribution decisions in ADR-0006 and ADR-0007.
