# Self-hosted application with managed Supabase

> **Supported beta target:** the public v0.1.1 source, build, migration replay, and container contracts are verified in CI. Deployment remains environment-specific and still requires an operator-owned staging and backup drill.

## Topology

```text
Public TLS endpoint
       |
Application runtime you operate
       |
Managed Supabase project
  database / auth / storage
       |
Optional server-side providers
```

## Prepare

1. Create separate development, staging, and production projects.
2. Restrict who can access project administration and service-role credentials.
3. Configure allowed authentication redirects for exact deployed origins.
4. Decide data region, retention, backups, and incident ownership.
5. Keep AI, email, and payment providers disabled until individually tested.

## Build gate

After the public source is present:

```bash
npm ci
npm run test:branding
npm run typecheck
npm run lint
npm run build
```

Run the complete local contract when preparing a release:

```bash
npm run verify
npm audit --omit=dev
```

## Configure the runtime

Set required variables from [configuration](../configuration.md) in the runtime's encrypted secret store. Only `NEXT_PUBLIC_*` values may be exposed to the browser. Do not bake `.env` or server credentials into an image or static artifact.

Use a non-root process, resource limits, TLS termination, structured logs without personal data, and a restart policy appropriate to your host.

### Docker Compose beta profile

After `npm run doctor` passes, build and start the application with the same ignored environment file:

```bash
docker compose --env-file .env.local config
docker compose --env-file .env.local up --build --detach
docker compose --env-file .env.local ps
```

The profile binds to `127.0.0.1:3000` by default, runs as a non-root user with a read-only filesystem, uses bounded in-memory scratch mounts, drops Linux capabilities, applies CPU/memory/process ceilings, and installs system FFmpeg for the optional media workflows. Put a TLS reverse proxy in front of it; do not expose a private admin port directly. Tune `ISYSTEM_PORT`, `ISYSTEM_CPU_LIMIT`, `ISYSTEM_MEMORY_LIMIT`, and `ISYSTEM_PIDS_LIMIT` only after observing representative workloads. `ISYSTEM_SCRATCH_SIZE` controls the writable `/tmp` tmpfs; it defaults to `1g` and must remain at least 1 GiB. Scratch usage counts toward the container memory ceiling, so raise `ISYSTEM_MEMORY_LIMIT` alongside it when representative media workloads require more headroom.

The application trusts a proxy-derived client address only through the single header named by `TRUSTED_CLIENT_IP_HEADER` (the Compose default is `x-trusted-client-ip`). Your proxy must overwrite that header on every request; never pass through a value supplied by the client. For example, a Caddy site can set the reviewed client address before proxying:

```caddyfile
isystem.example.com {
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Trusted-Client-IP {client_ip}
    }
}
```

If your proxy uses a different trusted, normalized header, set `TRUSTED_CLIENT_IP_HEADER` to its lowercase name. Do not point it at a multi-hop `X-Forwarded-For` value unless the proxy first replaces that value with exactly one validated address. Without a correctly overwritten trusted header, the application deliberately omits IP-based throttling rather than trusting spoofable input.

The application health endpoint is `/api/health`. Inspect sanitized logs with `docker compose logs --tail=100 app`. Container startup does not apply migrations or provision a workspace. Public CI builds with synthetic `.invalid` configuration, runs the image with a read-only root filesystem and dropped capabilities, waits for this health check, and scans the final runtime image for high and critical vulnerabilities.

For a non-container host, install FFmpeg separately when media modules are enabled, set the optional absolute `FFMPEG_PATH`/`FFPROBE_PATH` overrides when the executables are not on `PATH`, and run the verified standalone start command:

```bash
npm run build
npm start
```

## Database change sequence

Before any hosted migration, run the pinned local release contracts from `supabase/tests/README.md`. They reset the disposable project from zero, run pgTAP, and use two independent `psql` sessions to test booking-capacity serialization.

1. Back up production and test restoration.
2. Review migrations for locks, destructive operations, and backward compatibility.
3. Apply to staging using the exact command verified by the public release.
4. Exercise authentication, workspace isolation, core workflow, webhooks, and rollback.
5. Apply to production during an observed window.

Never assume a source rollback reverses a database migration.

## Acceptance checks

- Unauthenticated and cross-workspace requests fail closed.
- Browser bundles contain no server-only credentials.
- Optional features remain unavailable when unconfigured.
- Authentication callbacks return only to allowed origins.
- Webhooks reject invalid signatures and duplicate events.
- A backup can be restored into an isolated project.
- The previous application artifact remains available for rollback.

Record commit, schema version, configuration change, migration result, and operator for every deployment.
