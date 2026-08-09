# Backups and restore drills

A backup is only useful after a successful restore test. Define recovery objectives that match the impact of losing bookings, agreements, invoices, evidence, or customer access.

## Include

- PostgreSQL data and schema;
- authentication data needed for recovery;
- storage objects and their metadata;
- application configuration, excluding plaintext secret exports;
- migration and application version identifiers; and
- provider configuration needed to reconnect safely.

## Exclude or protect carefully

Do not put raw secrets, signing keys, payment credentials, or service-role tokens in ordinary configuration archives. Back them up through an approved secret-management process with separate access controls.

## Backup practice

1. Use provider-supported backups or a verified PostgreSQL-native method.
2. Encrypt backups in transit and at rest.
3. Keep multiple generations and an off-environment copy.
4. Restrict and audit restore access.
5. Monitor backup age, size, and failure.
6. Test restoration into an isolated environment on a schedule.

## Restore drill

Record:

- source environment and backup timestamp;
- application and schema versions;
- restore start and finish time;
- row counts or checksums for critical datasets;
- authentication and storage checks;
- a synthetic end-to-end workflow; and
- every manual correction required.

Never restore production data into a less-protected environment. If realistic data is required for performance testing, use an approved de-identification process and verify that re-identification is not possible.

## Failure modes to rehearse

- accidental record deletion;
- failed or partial migration;
- compromised credential rotation;
- unavailable application host;
- unavailable managed data platform; and
- corrupted or missing storage objects.

Provider dashboards and retention defaults change. Verify current behavior directly with the provider before relying on it.
