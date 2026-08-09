# Security model

iSystem OS is security-sensitive business software. This document states intended boundaries and operator responsibilities; it is not an audit, certification, or guarantee.

## Assets to protect

- identities, sessions, roles, and invitations;
- workspace and customer records;
- enquiries, bookings, portal content, and delivery evidence;
- agreements, signatures, invoices, receipts, and retained documents;
- provider credentials, webhook secrets, and privileged database keys; and
- audit-relevant events and backups.

## Adversaries and failure cases

Plan for unauthenticated abuse, compromised low-privilege accounts, cross-workspace access attempts, malicious uploads, webhook forgery and replay, prompt injection, dependency compromise, leaked secrets, operator mistakes, and unsafe migrations.

## Intended controls

| Boundary | Intended control | Public evidence status |
|---|---|---|
| Identity | Supabase authentication and server-side session refresh | Implemented; deployment redirects, invitations, and role policy still require operator verification |
| Tenant data | Workspace scoping plus database row-level security | Migration replay and representative negative contracts run in public CI; exercise your own enabled modules before production |
| Privileged operations | Server-only credentials and role/capability checks | Route-by-route review required |
| Public endpoints | Input validation, rate limits, bounded work | Abuse testing required |
| Webhooks | Signature, timestamp, replay, and idempotency checks | Provider journey required |
| User content | Output encoding and constrained rich-content handling | Rendering review required |
| AI | Explicit gating, metering, data minimization, untrusted output | Provider and prompt review required |
| Dependencies | Lockfile, Dependabot, source audit, and production audit workflow | v0.1.1 inventory and public CI scans are checked in; review package terms before redistribution |
| Operations | TLS, secret store, backups, monitoring, rollback | Deployment-specific |

## Non-negotiable rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or provider secrets to browser code.
- Authentication alone is not authorization. Check role, capability, resource ownership, and workspace.
- Enable row-level security on tenant data and test denial paths with different users.
- Validate input at every trust boundary and use parameterized database access.
- Treat filenames, rich text, URLs, generated content, and provider payloads as hostile.
- Keep payment and signature workflows idempotent and preserve evidence without silent mutation.
- Redact secrets and personal data from logs, analytics, issues, and AI prompts.
- Fail closed when optional security configuration is missing.

## AI-specific risks

Do not send customer data to an AI provider merely because a feature can. Document the data categories, region, retention behavior, and opt-out path. Validate generated output before storage or action. A model must not choose authorization, execute arbitrary tools, or alter records outside a user-confirmed scope.

## Shared responsibility

Maintainers are responsible for secure defaults and honest documentation in the public source. Operators are responsible for deployment hardening, identity administration, providers, legal basis, data retention, monitoring, backup, and incident response. Contributors are responsible for not introducing data, credentials, or code they cannot lawfully publish.

## Release security gate

Before public release, complete [the public release checklist](public-release-checklist.md), resolve [third-party notices](../THIRD_PARTY_NOTICES.md), and use a private advisory for unresolved vulnerabilities. Automated scanning supplements human review; it does not prove safety.
