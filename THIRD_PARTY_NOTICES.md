# Third-party notices

Apache-2.0 applies only to original iSystem OS contributions. Every dependency,
font, icon, media file, and copied-code fragment remains under its own license.
The deterministic package inventory for this snapshot is checked in at
[`docs/third-party-inventory.json`](docs/third-party-inventory.json) and is
regenerated with `npm run license:inventory` for every release.

## License families requiring specific attention

- `gsap@3.14.2` and `@gsap/react@2.1.2` are distributed under the GSAP Standard
  License, not an OSI-approved open-source license. They may be used by this
  application only in accordance with that license: <https://gsap.com/standard-license>.
- Sharp’s native image stack includes `libvips` components under
  LGPL-3.0-or-later, with the package-specific Apache/LGPL/MIT combinations
  recorded in the inventory. Keep the corresponding package notices when
  redistributing built artifacts.
- `caniuse-lite` carries CC-BY-4.0 data attribution. `dompurify` offers the
  MPL-2.0/Apache-2.0 choice. `json-schema` offers AFL-2.1/BSD-3-Clause, and
  `type-fest` offers MIT/CC0-1.0; the inventory records the exact package
  metadata for each version.
- `public/fonts/OFL.txt` contains the applicable SIL Open Font License notice
  for the checked-in font asset. Public image assets and their provenance are
  documented in [`docs/asset-provenance.md`](docs/asset-provenance.md).
- The public image-processing path expects an operator-provided system
  `ffmpeg`/`ffprobe`; this snapshot does not redistribute `ffmpeg-static` or a
  bundled FFmpeg binary.

Most MIT, BSD, ISC, Apache, MPL, LGPL, and other package notices remain in the
installed package manifests under `node_modules` and are represented in the
inventory. Downstream distributors must retain those notices in any bundled
artifact and review the source package terms before commercial redistribution.

This document is maintained alongside the lockfile and is not legal advice.
See [`docs/public-release-checklist.md`](docs/public-release-checklist.md) and
[`TRADEMARKS.md`](TRADEMARKS.md) for the original-code and brand boundaries.
