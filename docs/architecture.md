# Architecture

iSystem OS is organized as a modular, multi-tenant application for the service-business lifecycle.

```text
Visitor / team member / customer
                |
                v
      Web and API boundary
  auth + workspace + authorization
                |
       +--------+---------+
       |                  |
       v                  v
  Domain modules      Provider adapters
       |          AI / email / payments
       v
 Supabase data platform
 database + auth + storage
```

## Domain flow

The product direction connects four stages without forcing them into one undifferentiated module:

1. **Attract:** website, structured content, and SEO workflows.
2. **Convert:** enquiries, calls to action, and bookings.
3. **Operate:** customer records, workspace-scoped workflows, and team actions.
4. **Prove and close:** customer portal, agreements, invoices, receipts, and delivery evidence.

Each module should expose a narrow interface and preserve the workspace identifier across reads, writes, jobs, webhooks, and generated artifacts.

## Expected source boundaries

The private source audit indicates a Next.js application with domain modules under `src/features`, shared primitives under `src/shared`, routes under `src/app`, and Supabase migrations under `supabase/migrations`. These paths must be rechecked after extraction; the public source is authoritative.

## Trust boundaries

- The browser receives only public configuration and user-authorized data.
- Server-only code owns privileged Supabase and provider credentials.
- Authentication proves identity; authorization and row-level security decide access.
- Webhooks are untrusted input until signature, timestamp, replay, and ownership checks pass.
- AI output is untrusted content and must not bypass validation or authorization.
- Database migrations are release artifacts and require review, backup, and rollback planning.

## Extension principles

- Prefer workspace configuration, theme tokens, dictionaries, and feature flags over forks.
- Keep optional providers replaceable and disabled when unconfigured.
- Avoid provider SDKs in pure UI modules.
- Keep client-specific content and proprietary assets out of the public core.
- Treat new database tables and cross-module coupling as architectural changes.

See [security model](security-model.md) and [features and maturity](features-and-maturity.md).
