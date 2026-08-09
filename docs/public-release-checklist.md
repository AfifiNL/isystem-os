# Public release checklist

This checklist is mandatory for the first public source release and should be repeated for later releases in proportion to change risk.

## Provenance and privacy

- [ ] Export from an approved source snapshot without private git history.
- [ ] Review every file for customer data, employee data, private domains, emails, infrastructure identifiers, credentials, and internal commercial terms.
- [ ] Scan the final tree and generated build artifacts for secrets.
- [ ] Confirm examples and seeds are synthetic and redistribution-safe.
- [ ] Confirm no private branch, remote, deployment, or database operation is embedded in automation.

## Licensing and brand

- [ ] Confirm Apache-2.0 applies to every original file intended for release.
- [ ] Complete `THIRD_PARTY_NOTICES.md` from lockfiles and asset provenance.
- [ ] Review fonts, icons, images, templates, generated media, and copied snippets.
- [ ] Reconcile every shipped non-package asset with [asset provenance](asset-provenance.md).
- [ ] Preserve `NOTICE` and keep trademarked identity separate from the code license.
- [ ] Obtain legal review for unresolved ownership or licensing questions.

## Reproducibility

- [ ] Fresh clone on a clean machine.
- [ ] `./setup.sh` completes with the declared runtime.
- [ ] Required configuration matches runtime reads.
- [ ] Pinned Supabase CLI migration replay, pgTAP, and capacity-concurrency checks pass on the disposable local project.
- [ ] Database evidence uses a new run-specific directory, diagnostics are captured, and disposable-stack cleanup succeeds.
- [ ] `npm run test:branding` passes.
- [ ] `npm run typecheck` passes without relying on Next.js build error suppression.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Every published test command exists and passes.
- [ ] No uncommitted generated files are required.
- [ ] `PUBLIC_SNAPSHOT_MANIFEST.sha256` is regenerated with `npm run snapshot:manifest`, its diff is reviewed, and `npm run snapshot:verify` passes.

## Security and data integrity

- [ ] Cross-workspace negative tests pass for representative modules.
- [ ] Privileged keys are absent from browser bundles and logs.
- [ ] Public endpoints, uploads, webhooks, AI, email, and payments are reviewed when included.
- [ ] Dependency and secret scans are reviewed, not merely executed.
- [ ] GitHub Discussions is enabled and its public support link works.
- [ ] Private Security Advisories are enabled and a maintainer has verified the private reporting flow.
- [ ] Backup restoration succeeds in isolation.
- [ ] Upgrade and rollback steps are rehearsed.
- [ ] Open security findings are fixed or explicitly block release.

## Product truth

- [ ] Feature maturity matches verified journeys.
- [ ] README does not claim a demo, one-command deployment, container image, test suite, or integration that was not exercised.
- [ ] Known limitations and breaking-change risk are prominent.
- [ ] Documentation links and commands work.
- [ ] Release notes identify the exact commit and migration compatibility.
- [ ] The digest-pinned Docker image builds with synthetic configuration, runs non-root/read-only with dropped capabilities, passes its health check, and has no Trivy high/critical finding.
- [ ] The container exposes at least 1 GiB of bounded `/tmp` scratch space and its in-container FFmpeg/FFprobe media smoke passes.

## Required automated contract

The combined public candidate must pass its exported SHA-256 manifest and relative-import checks, `docs:public-check`, `test:bootstrap`, `test:branding`, `test:client-config`, `test:secret-scan`, `secret-scan`, `test:ai-contracts`, `test:ffmpeg`, `test:public-quality`, `test:dashboard-navigation`, `test:release-contracts`, `typecheck`, `lint`, `build`, and `npm audit --omit=dev`. The release-contract suite covers the atomic contact RPC boundary, public-media cache behavior, GSC sync outcomes, booking-email outcomes, customer booking management, and outreach. Database CI must reset the local schema, run every exported pgTAP suite, and run the two-session booking-capacity probe. The release gate additionally requires the exact `rg`, Gitleaks, TruffleHog, Trivy, Supabase CLI, Docker, and `psql` prerequisites declared by the repository; it scans source, `.next`, and the final runtime image.

Browser E2E and accessibility checks remain a documented manual release step until their public fixtures and CI behavior are stable:

- [ ] Run the applicable E2E journeys against a clean, synthetic public environment and retain sanitized evidence.
- [ ] Run the accessibility suite against the same build and triage every failure.

All GitHub Actions are pinned to immutable commits. Gitleaks and TruffleHog CI downloads are pinned by version and official archive SHA-256; Trivy and Supabase CLI versions are explicit. The pins were resolved from official repositories and registries on 2026-08-09; future upgrades must repeat that verification and update adjacent evidence comments.

Generate a deterministic dependency license inventory after `npm ci` with `npm run license:inventory`. Review that artifact alongside fonts, icons, media, templates, copied code, and upstream notice requirements. The `THIRD_PARTY_NOTICES_RELEASE_BLOCKER` marker must be removed only when verified notices replace the placeholder.

The local gate coordinates checks but does not replace human review:

```bash
bash scripts/public-release-gate.sh
```
