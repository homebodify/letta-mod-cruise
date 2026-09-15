# Provenance and license

- CruiseCode: `homebodify/letta-mod-cruisecode`, base `649fb16`. Git history is retained. Historical source, tests, docs and spec are in `legacy/cruise-code/`, excluded from the package. The inherited package did not declare a license.
- CruiseUX: `homebodify/letta-mod-cruiseux`, base `56f8c1a`. Adaptive interview, research, concept and validation guidance is adapted in `skills/cruising/references/ux.md`. Full history remains in the original repository. Its package declared Apache-2.0; the adapted guidance is textual, not copied code, and no incompatible license is asserted here.
- Dryforge: design reference only, https://github.com/prekuter/dryforge/tree/c950599d463d083a48e49c6dc1207904cf0c4374 . No Dryforge runtime or copied distribution is installed.

This repository is licensed under the MIT License (see LICENSE). `private: true` in
package.json blocks accidental npm publication of this private build; the license
governs the published source on GitHub and Tangled.
