# Getting started

> **Verification status:** verified from a fresh public GitHub clone for v0.1.1. The source bootstrap is runnable; Supabase provisioning and provider setup remain deliberate operator steps.

## 1. Understand the deployment boundary

The first supported target is the iSystem OS application hosted by you and connected to a managed Supabase project. Fully self-hosting the database platform is experimental. Read [deployment options](deployment/README.md) before choosing.

## 2. Check prerequisites

From the public release checkout, confirm the runtime declarations and install:

```bash
node --version
npm --version
./setup.sh
```

`setup.sh` requires the complete public source, uses `npm ci`, validates the checked-in `isystem.config.ts`, and creates `.env.local` from `.env.example` only when it is missing. It does not create infrastructure, apply migrations, seed data, or start the app. A clean run was verified on 2026-08-09 with Node 22.16.0 and npm 11.6.2.

Edit `isystem.config.ts` to set the workspace name, brand tokens, template, locales, module profile, public identity, and initial owner. Keep secrets in `.env.local`, never in the TypeScript config.

## 3. Create isolated infrastructure

Create a new Supabase project for this installation. Never reuse production credentials from another product or customer. Record:

- project URL;
- public anonymous key;
- server-only service role key; and
- database access needed by the verified migration workflow.

Restrict authentication redirect URLs to the local and deployed origins you actually use.

## 4. Configure the minimum environment

Edit `.env.local` and replace all required placeholders:

```text
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=<project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<public-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-key>
```

Keep optional AI, email, and payment variables empty until their features are deliberately enabled. See [configuration](configuration.md).

Before enabling staged booking emails or customer self-service links, generate an independent server-only value of at least 32 UTF-8 bytes for `BOOKING_MANAGEMENT_SECRET`. New links are always signed with this current value. Leave `BOOKING_MANAGEMENT_SECRET_PREVIOUS` blank except during a rotation: move the old current value into the previous variable, install a new current value, deploy both together, then remove the previous value only after every link it signed has expired. Do not copy the example placeholder into a deployed environment.

Run the read-only diagnostic before provisioning anything:

```bash
npm run doctor
```

The checked-in example values are intentionally placeholders, so a fresh clone reports starter blockers until you replace the four required values with credentials from your own Supabase project. Staged email and full AI/payment profiles are informational until you deliberately enable those providers.

## 5. Apply database changes

Link the pinned Supabase CLI to the new, empty project, review the target, and apply the checked-in migrations. Keep this version aligned with `scripts/public-tool-versions.sh` and CI:

```bash
npx --yes supabase@2.113.0 link --project-ref <your-project-ref>
npx --yes supabase@2.113.0 db push --dry-run
npx --yes supabase@2.113.0 db push
npm run seed:client
```

`seed:client` validates `isystem.config.ts` and idempotently provisions the workspace after migrations. Never point this workflow at another customer or production database.

## 6. Start in development

The expected development command is:

```bash
npm run dev
```

Open `http://localhost:3000`. If the command or port differs from the release, update this guide and `AGENTS.md` together.

## 7. Verify a minimal journey

Before adding real data, use synthetic records to verify:

1. an unauthenticated visitor cannot enter protected routes;
2. a test user can access only its assigned workspace;
3. a synthetic enquiry or booking remains in that workspace;
4. privileged actions reject a lower-privilege user; and
5. logs and error responses do not expose secrets.

Use [demo data guidance](demo-data.md). Then run the [public release gate](public-release-checklist.md) relevant to your snapshot.

## Next steps

- Read [security model](security-model.md) before production.
- Plan [backups and restore drills](backups.md).
- Choose and validate a [deployment path](deployment/README.md).
