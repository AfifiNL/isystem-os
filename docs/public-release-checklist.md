# Public release checklist

This checklist is mandatory for the first public source release and should be repeated for later releases in proportion to change risk.

## v0.1.1 evidence record

The published v0.1.1 artifact is the immutable tag `v0.1.1` at commit `fba89ccc1e663a6c3eac0a1efe431db5de175b4f`. The protected [tagged-commit Public CI run 31310665815](https://github.com/AfifiNL/isystem-os/actions/runs/31310665815) and [tagged-commit Security run 31310665817](https://github.com/AfifiNL/isystem-os/actions/runs/31310665817) cover the exported source manifest, relative-import closure, documentation, bootstrap/configuration contracts, strict typecheck, lint, build, migration replay, every exported pgTAP suite, booking-capacity concurrency, source secret scans, dependency audit, container health, and runtime image checks.

The publisher-owned release gates below are complete for v0.1.1. Deployment-specific legal and security review is kept separate and is not represented as a universal repository guarantee.

## Provenance and privacy

- [x] Export from an approved source snapshot without private git history.
- [x] Review every file for customer data, employee data, private domains, emails, infrastructure identifiers, credentials, and internal commercial terms.
- [x] Scan the final tree and generated build artifacts for secrets.
- [x] Confirm examples and seeds are synthetic and redistribution-safe.
- [x] Confirm no private branch, remote, deployment, or database operation is embedded in automation.

## Licensing and brand

- [x] Confirm Apache-2.0 applies to every original file intended for release; third-party packages and assets retain their own terms in the published notices and inventories.
- [x] Complete `THIRD_PARTY_NOTICES.md` from lockfiles and asset provenance.
- [x] Review fonts, icons, images, templates, generated media, and copied snippets.
- [x] Reconcile every shipped non-package asset with [asset provenance](asset-provenance.md).
- [x] Preserve `NOTICE` and keep trademarked identity separate from the code license.
- [x] Resolve publisher-owned licensing and ownership questions for the v0.1.1 export; jurisdiction-specific legal review remains deployment-specific.

Publisher sign-off: original project files are Apache-2.0 licensed. Dependencies and assets are separately attributed in `NOTICE`, `THIRD_PARTY_NOTICES.md`, `docs/third-party-inventory.json`, `docs/asset-provenance.md`, and `TRADEMARKS.md`.

## Reproducibility

- [x] Fresh clone on a clean machine.
- [x] `./setup.sh` completes with the declared runtime.
- [x] Required configuration matches runtime reads.
- [x] Pinned Supabase CLI migration replay, pgTAP, and capacity-concurrency checks pass on the disposable local project.
- [x] Database evidence uses a new run-specific directory, diagnostics are captured, and disposable-stack cleanup succeeds.
- [x] `npm run test:branding` passes.
- [x] `npm run typecheck` passes without relying on Next.js build error suppression.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] Every published test command exists and passes.
- [x] No uncommitted generated files are required.
- [x] `PUBLIC_SNAPSHOT_MANIFEST.sha256` is regenerated with `npm run snapshot:manifest`, its diff is reviewed, and `npm run snapshot:verify` passes.

## Security and data integrity

- [x] Cross-workspace negative tests pass for representative modules.
- [x] Privileged keys are absent from browser bundles and logs.
- [x] Public endpoints, uploads, webhooks, AI, email, and payments are reviewed when included.
- [x] Dependency and secret scans are reviewed, not merely executed.
- [x] GitHub Discussions is enabled and its public support link works.
- [x] Private Security Advisories are enabled and a maintainer has verified the private reporting flow.
- [x] Publisher-owned security findings are fixed or explicitly block release; the tagged security/source-audit checks pass and the public Dependabot and secret-scanning alert counts are zero.

## Product truth

- [x] Feature maturity matches verified journeys.
- [x] README does not claim a demo, one-command deployment, container image, test suite, or integration that was not exercised.
- [x] Known limitations and breaking-change risk are prominent.
- [x] Documentation links and commands work.
- [x] Release notes identify the exact immutable v0.1.1 tag commit and migration compatibility.
- [x] The digest-pinned Docker image builds with synthetic configuration, runs non-root/read-only with dropped capabilities, passes its health check, and has no Trivy high/critical finding with an upstream fix. The complete `trivy-full.json` report is retained; any unfixed high/critical findings require explicit security review before release.
- [x] The container exposes at least 1 GiB of bounded `/tmp` scratch space and its in-container FFmpeg/FFprobe media smoke passes.

## Required automated contract

The combined public release artifact must pass its exported SHA-256 manifest and relative-import checks, `docs:public-check`, `test:bootstrap`, `test:branding`, `test:client-config`, `test:secret-scan`, `secret-scan`, `test:ai-contracts`, `test:ffmpeg`, `test:public-quality`, `test:dashboard-navigation`, `test:release-contracts`, `typecheck`, `lint`, `build`, and `npm audit --omit=dev`. The release-contract suite covers the atomic contact RPC boundary, public-media cache behavior, GSC sync outcomes, booking-email outcomes, customer booking management, and outreach. Database CI must reset the local schema, run every exported pgTAP suite, and run the two-session booking-capacity probe. The release gate additionally requires the exact `rg`, Gitleaks, TruffleHog, Trivy, Supabase CLI, Docker, and `psql` prerequisites declared by the repository; it scans source, `.next`, and the final runtime image.

## Operator-owned deployment follow-up (not publisher release gates)

The following checks depend on the target deployment and must be completed by its operator:

- [ ] Obtain jurisdiction-specific legal, compliance, and provider/data-processing review.
- [ ] Complete a deployment-specific threat-model and security review, including backup restoration, upgrade/rollback rehearsal, provider-specific journeys, browser E2E, and accessibility evidence.

All GitHub Actions are pinned to immutable commits. Gitleaks and TruffleHog CI downloads are pinned by version and official archive SHA-256; Trivy and Supabase CLI versions are explicit. The pins were resolved from official repositories and registries on 2026-08-09; future upgrades must repeat that verification and update adjacent evidence comments.

Generate a deterministic dependency license inventory after `npm ci` with `npm run license:inventory`. Review that artifact alongside fonts, icons, media, templates, copied code, and upstream notice requirements. The published v0.1.1 release has verified notices in `THIRD_PARTY_NOTICES.md`; future changes must keep that inventory synchronized and must not reintroduce the release-blocker marker.

The local gate coordinates checks but does not replace human review:

```bash
bash scripts/public-release-gate.sh
```
