import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("canonical lifecycle-only writes survive the legacy customer compatibility trigger", () => {
    const migration = readFileSync(
        resolve(process.cwd(), "supabase/migrations/20260806170000_core_business_spine_customer_compatibility_trigger_repair.sql"),
        "utf8",
    );

    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.sync_workspace_customer_compatibility\(\)/i);
    assert.match(migration, /SELECT count\(\*\) = 8/i);
    assert.match(migration, /NEW\.lifecycle_status IS DISTINCT FROM OLD\.lifecycle_status/i);
    assert.match(migration, /NEW\.status IS NOT DISTINCT FROM OLD\.status/i);
    assert.match(migration, /WHEN 'qualified' THEN 'lead'::public\.workspace_customer_status/i);
    assert.match(migration, /WHEN 'customer' THEN 'lead'::public\.workspace_customer_status/i);
    assert.match(migration, /NOTIFY pgrst, 'reload schema'/i);
    assert.doesNotMatch(migration, /systems-blueprint|systems-fit-call/i);
    assert.doesNotMatch(migration, /UPDATE public\.workspace_customers/i);
});
