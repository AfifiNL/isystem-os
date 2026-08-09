# Security policy

iSystem OS handles workflows that may contain personal, contractual, and financial data. Treat every beta deployment as security-sensitive and perform an independent review before using real customer information.

## Supported versions

| Version | Security fixes |
|---|---|
| Latest public beta on the default branch | Best effort |
| Older commits, forks, and pre-public snapshots | Not supported |

There is no long-term-support release yet.

## Report a vulnerability privately

Use a [private GitHub Security Advisory](https://github.com/AfifiNL/isystem-os/security/advisories/new). Include:

- affected commit or version;
- impact and prerequisites;
- minimal reproduction steps or proof of concept;
- suggested mitigation, if known; and
- whether the issue is already public.

Do not open a public issue, include real customer data, test against systems you do not own, or retain data you encounter accidentally.

## What to expect

Maintainers will make a best effort to acknowledge, reproduce, assess, fix, and coordinate disclosure. Response and remediation times depend on severity and maintainer availability; no service-level agreement is offered during beta.

## Operator responsibilities

- Keep application and database versions pinned and updated.
- Store secrets outside source control and rotate suspected exposures.
- Enforce TLS, least privilege, row-level security, and protected administrative access.
- Restrict redirect URLs, webhook origins, CORS, and provider credentials.
- Test backups and restores.
- Disable optional providers until configured and verified.
- Review logs, retention, consent, tax, signature, and privacy obligations for your jurisdiction.

Read [docs/security-model.md](docs/security-model.md). The presence of a workflow, scanner, or policy is not evidence that a deployment is secure or compliant.
