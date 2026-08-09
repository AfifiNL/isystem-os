# Fully self-hosted stack

> **Planned/experimental:** a fully self-hosted Supabase deployment has not been validated for the public beta. This page defines the work required; it is not an installation guide or support commitment.

Running the application and the complete data platform adds responsibility for PostgreSQL, authentication, storage, API gateways, TLS, secrets, mail dependencies, observability, upgrades, and disaster recovery.

## Required validation before support

- Pin and publish compatible application and Supabase component versions.
- Verify migrations against a clean self-hosted database and an upgraded database.
- Verify authentication callbacks, token signing, session refresh, and password recovery.
- Verify storage policies, signed URLs, file-size limits, and malware-handling posture.
- Verify row-level security and privileged service operations.
- Document SMTP, ingress, certificates, internal networking, and secret rotation.
- Test backup and restore for database, storage objects, and required configuration.
- Test application and data-platform upgrades independently and together.
- Provide health checks that distinguish safe liveness from dependency readiness.

## Operational minimum

Do not expose database or internal administrative services directly to the internet. Use least-privilege networks, encrypted backups, monitored capacity, and an upgrade rehearsal environment. Separate public anonymous credentials from privileged service credentials and rotate signing material using a documented procedure.

## Current recommendation

Use [a self-hosted application with managed Supabase](managed-supabase.md) for beta evaluation. Contributors interested in full self-hosting should begin with a reproducible architecture proposal and validation matrix, not unverified deployment snippets.
