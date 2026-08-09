# Disposable database release checks

These tests exercise the public candidate's release-critical database contracts
without calling external providers. The pgTAP files run inside transactions and
roll back their fixtures.

Use the same pinned Supabase CLI version as CI and run only against the local,
disposable project declared in `supabase/config.toml`:

```bash
npx --yes supabase@2.113.0 start
npx --yes supabase@2.113.0 db reset --no-seed
npx --yes supabase@2.113.0 test db supabase/tests
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  bash supabase/tests/booking_capacity_concurrency.sh
npx --yes supabase@2.113.0 stop --no-backup --project-id isystem-os-public-ci
```

The concurrency probe requires `psql` and refuses non-loopback database URLs.
It opens two independent sessions and verifies that advisory locking serializes
competing bookings and rejects an over-capacity insert. Never use `--linked` or
point these release tests at a hosted or production database.

Maintainers can run `bash scripts/run-public-database-tests.sh` to execute the
same sequence and create a new run-specific evidence directory under
`artifacts/`. The helper rejects reused evidence paths, captures diagnostics
before shutdown, and fails the run if the disposable stack cannot be removed.
