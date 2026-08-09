# Upgrading

iSystem OS has no stable compatibility promise during public beta. Treat every upgrade as an application, schema, configuration, and provider-contract change.

## Before upgrading

1. Read the changelog and compare environment templates.
2. Inventory local modifications and provider versions.
3. Back up database, storage objects, and deployment configuration.
4. Restore the backup into an isolated environment.
5. Review every migration between the current and target commits.
6. Build and exercise the target release against restored data.
7. Confirm a rollback artifact and decision threshold.

## Deploy safely

Prefer backward-compatible, expand-and-contract schema changes. Deploy code that tolerates both old and new schema during rolling updates. Avoid mixing destructive migrations with unrelated feature changes.

The exact migration and production start commands must come from the verified release; this guide deliberately does not invent them.

## Verify after deployment

- authentication and session refresh;
- role and cross-workspace denial paths;
- public form and booking boundaries;
- portal access;
- document and invoice retrieval permissions;
- configured provider webhooks and idempotency;
- logs, error rate, latency, and background work; and
- creation plus retrieval of a new backup.

## Rollback

Application rollback and database rollback are different. Prefer rolling the application back to a known artifact while leaving backward-compatible schema additions in place. Reverse a migration only when its down path has been reviewed and tested against representative restored data.

Record deviations and add them to [troubleshooting](troubleshooting.md) or the release notes.
