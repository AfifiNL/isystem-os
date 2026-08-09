# Deployment options

iSystem OS separates application hosting from the Supabase data platform. Choose the simplest model that gives your team the operational control it can actually support.

| Model | Status | You operate | External dependency |
|---|---|---|---|
| Self-hosted app + managed Supabase | Initial beta target; verification required | App runtime, secrets, domains, monitoring | Supabase project |
| Fully self-hosted app + Supabase | Experimental/planned | App, database, auth, storage, networking, backups, upgrades | Optional providers only |

Neither path is a one-command production deployment. Both require TLS, secret management, migration review, backups, monitoring, and a rollback plan. The repository includes a hardened application-only Docker Compose profile; it deliberately does not embed Supabase or provider credentials.

## Baseline release artifact

A deployable commit should include:

- a locked dependency graph;
- a successful production build;
- reviewed migrations;
- documented required environment variables;
- a release identifier visible to operators;
- verified health behavior that does not expose sensitive details; and
- a matching backup and rollback plan.

`Dockerfile` and `compose.yaml` are the beta application artifact. A release remains blocked until the digest-pinned image builds, runs non-root with a read-only root filesystem and dropped capabilities, passes its health check, and passes the high/critical image vulnerability scan in CI or equivalent retained release evidence.

## Guides

- [Self-hosted application with managed Supabase](managed-supabase.md)
- [Fully self-hosted stack](self-hosted.md)
- [Backups](../backups.md)
- [Upgrading](../upgrading.md)
- [Security model](../security-model.md)
