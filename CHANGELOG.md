# Changelog

All notable public changes will be documented here. The format follows Keep a Changelog principles, and releases are expected to use semantic versioning once the public version baseline is verified.

## [Unreleased]

### Added

- Public packaging, governance, security, support, contribution, deployment, and operator documentation.
- Conservative GitHub issue, pull-request, dependency, CI, and release scaffolding.
- Apache-2.0 license with separate notice, trademark, and third-party attribution gates.

### Security

- Added private vulnerability-reporting guidance and a public-release secret/identity review gate.

### Known limitations

- Product capabilities remain beta and are tracked in [the feature maturity matrix](docs/features-and-maturity.md).
- Browser E2E/accessibility, backup restore, and provider-specific journeys remain operator release steps rather than a universal hosted-service guarantee.

## [0.1.2] - 2026-11-09

Security release. It ships the dependency update merged in [#46](https://github.com/AfifiNL/isystem-os/pull/46); no change to application behaviour is intended.

### Security

- Dependency security update: `npm audit --omit=dev` reports zero findings again (it reported 23, two of them critical, against the v0.1.1 lockfile in November 2026).
  - Next.js and `eslint-config-next` 15.5.21 → 15.5.29, for the Image Optimization remote-code-execution advisories (GHSA-2464-fhr4-w9xw, GHSA-2xp9-vwfh-vxw4), the SSG/ISR cache-poisoning advisories and the Server Actions denial-of-service advisory.
  - DOMPurify override 3.4.13 → 3.4.17 (GHSA-cg2g-xh64-v4q7, GHSA-mrv2-3pqr-j5jr).
  - Tiptap 3.20.0 → 3.33.0 for every `@tiptap/*` package, with prosemirror-view 1.42.9; happy-dom 21.0.4 through an override, because `@puckeditor/core` 0.22 still declares happy-dom ^20.
  - Zod 4.6.7, sharp 0.35.5, and the AI SDK raised to the first releases on `@ai-sdk/provider-utils` 4.0.33 (`ai` 6.0.214, `@ai-sdk/google` 3.0.86, `@ai-sdk/google-vertex` 4.0.152, `@ai-sdk/openai` 3.0.77, `@ai-sdk/react` 3.0.216).
  - New scoped overrides: fflate 0.8.3 for three-stdlib, postcss-selector-parser 6.1.6 for `@tailwindcss/typography`, and KaTeX 0.18.11 for Mermaid (KaTeX 0.17 and 0.18 change only an internal API and internal CSS class names; Mermaid calls `render` and `renderToString`).
  - Development tooling: the brace-expansion pins move to fixed releases (1.1.21, 2.1.7, 5.0.12), `@hono/node-server` 2.0.11 → 2.1.6 for the MCP SDK, and in-range updates for undici, fast-uri, hono, proxy-addr, ip-address, js-yaml, systeminformation, `@humanfs/node`, `@modelcontextprotocol/sdk`, body-parser and qs. Eleven development-only findings remain in the shadcn CLI and the typescript-eslint minimatch chain; both need major upgrades and neither ships in the application or its container image.
  - `@opentelemetry/api` stays at 1.9.0 through an override. The AI SDK update would otherwise resolve 1.10.0, whose CommonJS build gives a propagator helper a generated name ending in `re_` plus more than 20 letters; the generated-output secret scan's API-key pattern flags that name in the middleware source map.
  - `docs/third-party-inventory.json` regenerated: one package added (Apache-2.0), 26 removed, no license changes.

### Upgrade notes

- No database migrations changed since v0.1.1, so an existing v0.1.1 database needs no migration. Run `npm ci` after pulling to install the new lockfile.

## [0.1.1] - 2026-08-09

### Added

- Complete Apache-2.0 public source snapshot with typed starter configuration, safe bootstrap/doctor helpers, deployment guides, community policies, and release evidence.
- Fresh migration replay, pgTAP, booking-capacity concurrency, tenant-security, secret-scanning, container-health, and runtime-image contracts in public CI.

### Security

- Zero npm audit findings in the locked dependency graph at release time.
- Independent Gitleaks, TruffleHog, and generated-output scans for the source and production build.

## [0.1.0] - 2026-08-09

- Initial public beta tag; see the immutable `v0.1.0` release for its exact source snapshot.

[Unreleased]: https://github.com/AfifiNL/isystem-os/commits/main
[0.1.2]: https://github.com/AfifiNL/isystem-os/releases/tag/v0.1.2
[0.1.1]: https://github.com/AfifiNL/isystem-os/releases/tag/v0.1.1
[0.1.0]: https://github.com/AfifiNL/isystem-os/releases/tag/v0.1.0
