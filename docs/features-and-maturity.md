# Features and maturity

This matrix prevents positioning from outrunning evidence. It is the product truth for the public v0.1.1 snapshot and must be updated from verified user journeys before every release.

## Status labels

- **Candidate:** included in the public source, but the complete end-to-end journey or operator evidence is not yet a public release claim.
- **Experimental:** available or documented for evaluation, but incomplete or likely to change.
- **Planned:** direction only; do not present as implemented.
- **Verified beta:** reserved for a capability exercised successfully from a fresh public clone.

The source, bootstrap, migration, security, and container contracts are verified for v0.1.1. Product capabilities retain the more conservative labels below until their complete public journeys are exercised.

## Verified release foundations

| Foundation | Evidence |
|---|---|
| Fresh public source bootstrap | `./setup.sh` from a clean GitHub clone installs the lockfile, validates `isystem.config.ts`, creates a mode-600 `.env.local`, and leaves provider/database setup explicit. |
| Configuration and safety contracts | `npm run test:bootstrap`, `npm run test:client-config`, `npm run test:branding`, and `npm run docs:public-check` pass on the release commit. |
| Application build and runtime packaging | Public CI [run 31306431973](https://github.com/AfifiNL/isystem-os/actions/runs/31306431973) passes typecheck, lint, build, standalone preparation, Compose validation, read-only health smoke, and the runtime image gate. |
| Database replay and tenant contracts | The same CI run replays every migration from zero, runs all exported pgTAP suites, and runs the two-session booking-capacity probe. |
| Dependency and source security | Public CI [security run 31306431961](https://github.com/AfifiNL/isystem-os/actions/runs/31306431961) passes the packaging validator, Gitleaks, TruffleHog, source secret scan, and production dependency audit. |

These foundations make the repository usable for evaluation, development, and a controlled beta deployment. They do not replace an operator's review of identity, authorization, backups, providers, legal obligations, or production data handling.

| Area | Intended outcome | Current public status | Verification needed |
|---|---|---|---|
| Website and content | Publish service-business pages and content | Candidate | Build, publish, localization, workspace isolation |
| SEO workflows | Inspect and improve discoverability | Candidate | Audit/apply/rollback behavior and permissions |
| Enquiries and conversion | Capture interest into an owned workflow | Candidate | Form abuse controls, routing, consent, isolation |
| Booking | Move a prospect into a scheduled service | Candidate | Availability, concurrency, notifications, cancellation |
| Customer workflow | Organize work by tenant and role | Candidate | RLS, role matrix, cross-workspace negative tests |
| Customer portal | Give customers scoped access to their work | Candidate | Access gate, template dispatch, session boundaries |
| Agreements and evidence | Draft, sign, retain, and trace documents | Candidate | Signature evidence, immutability, retention, authorization |
| Invoices and receipts | Record service-business financial artifacts | Candidate | Currency, tax assumptions, numbering, export, permissions |
| AI assistance | Generate or improve approved content | Candidate | provider failure, metering, prompt/data boundaries, opt-out |
| Email delivery | Send workflow and newsletter messages | Candidate | verified sender, unsubscribe, webhook replay, retries |
| Payment checkout | Create and verify payment events | Candidate | sandbox journey, signature verification, idempotency |
| Self-hosted app + managed Supabase | Operator-controlled application hosting | Candidate | fresh deploy, migration, rollback, backup restore |
| Fully self-hosted Supabase | Operator controls app and data platform | Planned | compatibility, storage/auth routing, upgrade playbook |
| Synthetic demo workspace | Safe evaluation without customer data | Planned | schema-aligned generator and teardown path |

## Not a compliance claim

Features relating to consent, retention, agreements, signatures, invoices, or tax records are implementation aids. They do not make a deployment compliant with GDPR, e-signature law, bookkeeping rules, tax law, or any other regime. Operators must obtain appropriate advice and validate configuration for their jurisdiction.

When a capability becomes Verified beta, link the verifying test, runbook, or release evidence in this file.
