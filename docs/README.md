# Documentation

The documentation is organized around the decisions an evaluator, contributor, or operator needs to make.

## Evaluate

- [Architecture](architecture.md)
- [Features and maturity](features-and-maturity.md)
- [Security model](security-model.md)
- [Asset provenance](asset-provenance.md)
- [Roadmap](../ROADMAP.md)

## Configure and run

- [Getting started](getting-started.md)
- [Configuration](configuration.md)
- [Providers](providers.md)
- [Demo data](demo-data.md)
- [Troubleshooting](troubleshooting.md)

## Operate

- [Deployment](deployment/README.md)
- [Self-hosted app with managed Supabase](deployment/managed-supabase.md)
- [Fully self-hosted stack](deployment/self-hosted.md)
- [Upgrading](upgrading.md)
- [Backups and restore drills](backups.md)
- [Public release checklist](public-release-checklist.md)

Validate this public documentation set and all repository-local Markdown links with `npm run docs:public-check` once the combined source candidate provides its package scripts. The underlying overlay checker is `node scripts/check-public-docs.mjs`.

Documentation describes the intended public product. Capability labels in [features and maturity](features-and-maturity.md) take precedence over marketing language.
