# Asset provenance

This inventory records the non-package media intentionally shipped in the public repository. [The machine-checked asset manifest](public-assets-manifest.txt) lists every shipped file under `public/`; any unlisted asset is a release blocker until its provenance is reviewed.

## Project-created media

| Public path | Origin | Public-use note |
|---|---|---|
| `public/brand/github-social-preview.jpg` | New-image generation with OpenAI image generation on 2026-08-09; prompt requested an iSystem OS wordmark beside a six-stage service-business operating loop on a midnight-navy/cyan technical background. Resized to 1280×640 and encoded as JPEG. | Official-project promotional media. The image file may be redistributed with the repository, but its iSystem name and visual identity remain subject to `TRADEMARKS.md`. |
| `public/stealth-cto-hero.png` | New-image generation with OpenAI image generation on 2026-08-09; prompt requested a square, identity-free orchestration core connecting website, enquiry, booking, workflow, document, and analytics modules. Resized to 768×768 PNG. | Original project media distributed under Apache-2.0 with the repository. |
| `public/themes/facility-services/hero.jpg` | New-image generation with OpenAI image generation on 2026-08-09; prompt requested a generic, unbranded facility-operations scene with no customer identity. Resized to 1600×853 and encoded as JPEG. | Original project demo media distributed under Apache-2.0 with the repository. It does not depict or endorse a real customer. |
| `public/themes/facility-services/logo.svg` | Code-authored geometric placeholder mark created for the neutral facility-services demo. | Original project demo media distributed under Apache-2.0. It must be replaced for a real deployment. |

Generation was performed in new-image mode, without a reference image. Post-processing changed only dimensions and encoding; the original generation outputs remain outside the repository.

## Project marks

Files under `public/isystem-assets/` are official iSystem project identity assets supplied by the project owner. They may be redistributed as part of an unmodified official source release, but they are not granted for branding a fork or hosted service. See `TRADEMARKS.md`.

## Fonts

- Inter is distributed under the SIL Open Font License 1.1. “Inter” is a Reserved Font Name. Source: <https://github.com/rsms/inter>.
- Noto Sans Arabic is distributed under the SIL Open Font License 1.1. Source: <https://github.com/notofonts/arabic>.

The public snapshot must include the corresponding OFL license text alongside the font files.

## Environment map

`public/three/environments/potsdamer_platz_1k.hdr` is the Potsdamer Platz HDRI by Greg Zaal from Poly Haven, released under CC0: <https://polyhaven.com/a/potsdamer_platz>.

## Framework starter asset

`public/file.svg` is the unmodified file icon from the TypeScript/Tailwind Create Next App template at Next.js commit [`2b9f1bcb6142d1daf6dc59a02bf829ee4cbb914b`](https://github.com/vercel/next.js/blob/2b9f1bcb6142d1daf6dc59a02bf829ee4cbb914b/packages/create-next-app/templates/app-tw/ts/public/file.svg). Its SHA-256 is `2b67812c325c199a02536cdbeea0c593a72f707d323b72ee3e08dbab06753bd4`. Next.js is distributed under the [MIT license](https://github.com/vercel/next.js/blob/2b9f1bcb6142d1daf6dc59a02bf829ee4cbb914b/license.md). The neutral starter config currently uses this icon as its placeholder logo.

## Third-party product marks

Technology logos under `public/tech-stack/` identify compatible technologies. Their names and logos remain the property of their respective owners, and inclusion does not imply endorsement. Remove or replace them if a deployment does not use the named technology.

## Excluded media

The public export deliberately excludes private campaign PDFs, client media, customer logos, customer photographs, the old default background video, historical visual-regression screenshots, and the unused framework starter icons (`globe.svg`, `next.svg`, and `window.svg`). Operators should add only media they own or have documented permission to redistribute.
