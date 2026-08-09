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

## [0.1.0] - 2026-08-09

### Added

- Complete Apache-2.0 public source snapshot with typed starter configuration, safe bootstrap/doctor helpers, deployment guides, community policies, and release evidence.
- Fresh migration replay, pgTAP, booking-capacity concurrency, tenant-security, secret-scanning, container-health, and runtime-image contracts in public CI.

### Security

- Zero npm audit findings in the locked dependency graph at release time.
- Independent Gitleaks, TruffleHog, and generated-output scans for the source and production build.

[Unreleased]: https://github.com/AfifiNL/isystem-os/commits/main
[0.1.0]: https://github.com/AfifiNL/isystem-os/releases/tag/v0.1.0
