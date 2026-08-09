import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(new URL(
    "../../../../supabase/migrations/20260806110000_booking_confirmed_meeting_invariant.sql",
    import.meta.url,
));

test("database rejects confirmed remote reservations without a ready customer join URL", () => {
    const source = readFileSync(migrationPath, "utf8");
    assert.match(source, /BEFORE INSERT OR UPDATE OF status, workspace_id, service_id ON public\.booking_reservations/i);
    assert.match(source, /NEW\.status (?:=|<>) 'confirmed'/i);
    assert.match(source, /booking_meetings/i);
    assert.match(source, /status = 'ready'/i);
    assert.match(source, /join_url IS NOT NULL/i);
    assert.match(source, /ERRCODE = '23514'/i);
    assert.match(source, /pg_advisory_xact_lock/i);
    assert.match(source, /booking_meetings_preserve_confirmed_ready/i);
    assert.match(source, /BEFORE UPDATE OF workspace_id, reservation_id, provider, status, join_url OR DELETE/i);
    assert.match(source, /other_meeting\.id <> OLD\.id/i);
    assert.doesNotMatch(source, /OLD\.status = 'confirmed'\) THEN/i);
    assert.match(source, /booking_services_preserve_confirmed_meetings/i);
    assert.match(source, /BEFORE UPDATE OF workspace_id, virtual_meeting_provider, auto_create_virtual_meeting/i);
    assert.match(source, /Meeting-provider changes require every confirmed reservation/i);
});
