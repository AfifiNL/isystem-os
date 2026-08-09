# Troubleshooting

Start by recording the public commit, operating system, Node and npm versions, deployment model, failing route or command, and sanitized error. Never post `.env`, tokens, cookies, customer records, or complete webhook payloads.

## Bootstrap says source is missing

`setup.sh` requires the complete public application source plus `package.json` and `package-lock.json`. Obtain a tagged public release; do not copy files from a private deployment ad hoc.

## `npm ci` rejects the lockfile

Confirm you are using npm and the runtime version declared by the public snapshot. Do not replace `npm ci` with an unlocked install to hide drift. Regenerate a lockfile only in a reviewed dependency update.

## The app builds but authentication loops

Check `NEXT_PUBLIC_SITE_URL`, Supabase project URL and public key, allowed redirect origins, proxy headers, TLS termination, and cookie security. Confirm system clocks are correct. Do not weaken cookie or redirect validation as a shortcut.

## A user sees the wrong workspace

Treat this as a potential security vulnerability. Stop testing with real data, preserve sanitized evidence, check membership and row-level policies, and report privately under [SECURITY.md](../SECURITY.md).

## AI features are unavailable

This is expected when AI is disabled or incomplete. Confirm the explicit provider selector and required server-only variables. Check region and permission errors without logging credentials or prompts containing customer data.

## Email does not arrive

Check verified sender state, recipient sandbox rules, provider event status, webhook signature configuration, suppression or complaint status, and dispatch authorization. Use only synthetic recipients while diagnosing.

## Payment state does not update

Stay in sandbox. Compare trusted order amount/currency, provider event identifier, webhook signature result, replay handling, and capture status. Do not edit database payment state manually without an auditable recovery procedure.

## A migration fails

Stop repeated attempts, capture the exact migration and database version, and inspect whether it partially applied. Restore an isolated backup to reproduce. Do not delete migration history or apply guessed SQL to production.

## Where to continue

Use [GitHub Discussions](https://github.com/AfifiNL/isystem-os/discussions) for sanitized setup questions, [GitHub Issues](https://github.com/AfifiNL/isystem-os/issues) for reproducible public bugs, and a private advisory for security impact.
