# Demo data

> **Planned:** no public demo dataset or seeding command is claimed until it is generated against the extracted schema and teardown is verified.

Demo data must be synthetic, obviously fictional, and safe to publish. It must never be copied or transformed from a customer database.

## Proposed scenario

A future seed can model a fictional service team named **Northstar Studio** with:

- a test workspace and two roles;
- a fictional service and availability window;
- an enquiry that becomes a booking;
- a customer portal record;
- a draft agreement and invoice with non-payable identifiers; and
- delivery evidence that contains no real people, addresses, or assets.

Use reserved values such as `owner@example.invalid` and local URLs. Do not use real phone numbers, identity numbers, tax numbers, bank details, payment tokens, signatures, or copyrighted media.

## Acceptance criteria for a future seed

- deterministic and idempotent for a documented test workspace;
- refuses to run against an environment marked as production;
- uses schema-valid identifiers and relationships;
- creates no outbound email, payment, AI, or webhook side effects;
- cannot grant access to an existing account;
- provides a tested teardown path scoped only to seeded records; and
- is exercised in CI against an isolated database.

Until those criteria are met, create small synthetic records manually in an isolated development environment.
