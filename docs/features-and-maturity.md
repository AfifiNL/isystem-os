# Features and maturity

This matrix prevents positioning from outrunning evidence. It must be updated from the sanitized public source and verified user journeys before every release.

## Status labels

- **Candidate:** observed in the private source audit; public extraction and clean-room verification remain.
- **Experimental:** available or documented for evaluation, but incomplete or likely to change.
- **Planned:** direction only; do not present as implemented.
- **Verified beta:** reserved for a capability exercised successfully from a fresh public clone.

No capability is labeled Verified beta yet.

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
