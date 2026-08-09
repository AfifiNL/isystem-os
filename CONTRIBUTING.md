# Contributing to iSystem OS

Thank you for helping make service-business software easier to understand, operate, and adapt. iSystem OS is in public beta, so small, well-evidenced changes are especially valuable.

## Before you start

- Use GitHub Discussions for proposals and support questions.
- Search existing issues before opening a new one.
- Use a private Security Advisory for vulnerabilities; never publish exploit details in an issue.
- Keep a contribution focused on one problem. Large architectural changes need a proposal before implementation.

## Development setup

The public extraction must contain `package.json`, `package-lock.json`, and application source before it is runnable. Once those files are present:

```bash
./setup.sh
npm run
npm run docs:public-check
```

`./setup.sh` installs locked npm dependencies and creates `.env.local` when needed; it does not provision providers or a database. Follow [docs/getting-started.md](docs/getting-started.md). Use npm exclusively.

## Workflow

1. Fork `AfifiNL/isystem-os` and branch from the default branch.
2. Name the branch by intent, such as `fix/portal-access` or `docs/backup-drill`.
3. Add or update tests when a verified test harness covers the changed behavior.
4. Update docs and [feature maturity](docs/features-and-maturity.md) when behavior or configuration changes.
5. Run the smallest relevant checks, then the public release gate where applicable.
6. Open a pull request using the repository template and explain verification evidence.

Do not include real customer data, credentials, deployment identifiers, private URLs, copied proprietary material, or generated assets with unclear rights.

## Code and architecture expectations

- Preserve strict TypeScript and the existing import alias.
- Keep domain behavior within the relevant feature module.
- Keep provider credentials and privileged clients server-only.
- Scope all data access to the active workspace and preserve row-level security.
- Prefer configuration and reusable renderers over brand-specific branches in shared code.
- Keep migrations forward-safe, narrowly scoped, and documented.
- Return useful, non-sensitive errors; do not log secrets or personal data.

## Pull requests

Maintainers review correctness, security boundaries, tenant isolation, migration safety, accessibility, documentation, and evidence that the change works. A maintainer may request a smaller PR or a design proposal.

By intentionally submitting a contribution, you agree that it is licensed under Apache-2.0 and represent that you have the right to submit it. No contributor license agreement is currently required; this may be revisited transparently through governance.

## Using Codex

Codex reads [AGENTS.md](AGENTS.md). Ask it to inspect the actual source before proposing architecture or commands, keep changes public-safe, and run `bash scripts/validate-public-packaging.sh` before handoff. Human review remains required for security, migrations, licenses, and release claims.

## Recognition

Contributors may be acknowledged in release notes or project history. Contribution does not grant permission to use iSystem marks; see [TRADEMARKS.md](TRADEMARKS.md).
