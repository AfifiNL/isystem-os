# iSystem OS

**Status:** Published public beta v0.1.1 | **Expected port:** 3000 | **Expected stack:** Next.js, TypeScript, React, Supabase

## What

iSystem OS is a self-hostable business OS for service teams. The public release includes the application source and verification gates; never infer that a product capability is production-ready until its maturity label and operator evidence confirm it.

## Safety boundary

- Never copy secrets, customer data, git history, deployment identifiers, or private operational docs into the public tree.
- Use synthetic values and reserved `.invalid` email domains in examples.
- Preserve workspace isolation and authorization checks in every read and write.
- Do not claim a feature, command, test, deployment path, or security control is working without evidence.
- Do not publish or push from an agent task unless the user explicitly authorizes that exact action.

## Bootstrap

```bash
./setup.sh
```

`setup.sh` installs locked npm dependencies and runs the safe local setup helper. The helper creates `.env.local` only when missing, validates `isystem.config.ts`, and never overwrites the local environment without explicit interactive confirmation. Provider setup, database provisioning, migrations, and launch remain separate.

## Verification commands

Run these only after `package.json`, `package-lock.json`, and application source are present:

```bash
npm run dev          # Expected local server on :3000
npm run setup        # Safe local env/config bootstrap
npm run doctor       # Read-only prerequisite and configuration check
npm run typecheck    # Strict TypeScript validation
npm run lint         # ESLint
npm run build        # Production build
npm run docs:public-check # Public documentation links and references
npm run test:bootstrap    # Setup, doctor, and non-overwrite safety contracts
npm run test:branding     # Reusable branding and public-boundary contracts
npm run test:ffmpeg       # Media executable resolution and concat contracts
npm run test:release-contracts # Contact/media/GSC/booking/outreach release contracts
npm run test:secret-scan  # Secret-scanner regression tests
npm run secret-scan       # Scan source and generated output for credentials
npm run snapshot:verify   # Verify the exported SHA-256 source manifest
npm run imports:verify    # Verify relative dependency closure for exported scripts
```

The combined public candidate must also expose `test:client-config`, `test:ai-contracts`, `test:public-quality`, `test:dashboard-navigation`, and `test:release-contracts`. `npm run verify` coordinates the documented npm checks. The database release workflow separately replays migrations, runs pgTAP, and exercises booking-capacity concurrency against the disposable local Supabase project. There is no generic `npm test` command.

## Public architecture

```text
src/app/             Routes and API boundary
src/features/        Domain modules
src/shared/          Shared UI, workspace, data, and provider helpers
supabase/migrations/ Versioned database changes
supabase/tests/      pgTAP and local concurrency release contracts
docs/                Public operator and contributor guidance
.github/              Community, CI, dependency, and release configuration
```

Browser requests enter the application boundary, which resolves authentication and workspace context before calling domain modules. Data access is expected to use Supabase with row-level security; optional providers must remain behind server-only configuration.

## Key files

```text
README.md                       Public project overview
docs/features-and-maturity.md   Evidence-based capability status
docs/configuration.md           Environment variable contract
docs/security-model.md          Trust boundaries and operator duties
docs/deployment/                Supported and experimental paths
SECURITY.md                     Vulnerability reporting policy
scripts/public-release-gate.sh  Pre-release verification gate
PUBLIC_SNAPSHOT_MANIFEST.sha256 Exported source-integrity manifest
```

## Change discipline

1. Make the smallest public-safe change.
2. Update feature maturity and configuration docs when behavior changes.
3. Add or update automated checks only when the underlying command is verified.
4. For an authorized public-source change, run `npm run snapshot:manifest` and review the manifest diff.
5. Run `bash scripts/validate-public-packaging.sh`.
6. Before a public release, run `bash scripts/public-release-gate.sh`.

## Contribution

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports follow [SECURITY.md](SECURITY.md), not public issues.
