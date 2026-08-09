import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("email workflow integration contracts", () => {
    it("atomically persists an inquiry with its durable jobs before targeted dispatch", () => {
        const source = read("src/app/api/contact/submit/route.ts");
        const schema = read("src/features/contact/schema.ts");
        const genericForm = read("src/features/contact/ui/public-contact-form.tsx");
        const templateForm = read("src/features/templates/ui/theme-renderers/isystem-agency-contact.tsx");
        assert.match(source, /\.rpc\(\s*"submit_contact_inquiry_with_email_jobs"/);
        assert.doesNotMatch(source, /\.from\("contact_inquiries"\)/);
        assert.doesNotMatch(source, /enqueueTransactionalEmail/);
        assert.match(source, /dispatchTransactionalEmailJobsByIdempotencyKeys/);
        assert.match(source, /marketingConsent: input\.marketingConsent/);
        assert.match(source, /surface: "contact_inquiry"/);
        assert.match(source, /buildAtomicContactSubmission/);
        assert.match(source, /if \(plan\.subscribeToNewsletter\)/);
        assert.match(source, /newsletterSubscriptionFailed = true/);
        assert.match(source, /resolveContactWorkspace/);
        assert.match(source, /requestHost: req\.headers\.get\("host"\)/);
        assert.match(source, /p_submission_id: input\.submissionId/);
        assert.match(source, /p_submission_fingerprint: atomicSubmission\.fingerprint/);
        assert.match(source, /p_email_jobs: atomicSubmission\.emailJobs/);
        assert.match(source, /deliveryDegraded/);
        assert.match(source, /accepted: true/);
        assert.match(source, /getContactDeliveryDisposition\(delivery\)/);
        assert.match(source, /status: deliveryStatus/);
        assert.match(source, /if \(!emailConfig\)/);
        assert.match(schema, /marketingConsent: z\.boolean\(\)\.optional\(\)\.default\(false\)/);
        assert.match(genericForm, /marketingConsent: false/);
        assert.match(templateForm, /marketingConsent: false/);
        assert.match(genericForm, /submissionId/);
        assert.match(templateForm, /submissionId/);
        assert.doesNotMatch(source, /send\.isystem|https:\/\/isystem|noreply@example\.invalid/i);
        assert.doesNotMatch(source, /\.order\("created_at"[\s\S]*?\)\s*\.limit\(1\)/);
    });

    it("targets contact-triggered campaigns and advances only after campaign completion", () => {
        const source = read("src/features/newsletter/service.ts");
        assert.match(source, /target_contact_id: contactId/);
        assert.match(source, /selectAutomationRecipients\(candidateContacts, targetContactId\)/);
        assert.match(source, /advanceAutomationAfterCampaign\(supabase, campaign\)/);
        assert.doesNotMatch(
            source.slice(source.indexOf("async function runAutomationJobs"), source.indexOf("async function runCampaignJobs")),
            /current_step_position: nextStep\.position/,
        );
    });

    it("uses one-time portal activation links instead of hidden random passwords", () => {
        const source = read("src/features/booking/actions.ts");
        assert.match(source, /generateLink\(\{\s*type: "invite"/);
        assert.match(source, /eventType: portalPlan\.event/);
        assert.doesNotMatch(source, /buildProvisionedPassword|Book!\$\{/);
    });

    it("runs booking retries, appointment reminders, expiry recovery, and post-session follow-up", () => {
        const source = read("src/app/api/booking/payment-followups/route.ts");
        const bookingForm = read("src/features/booking/ui/public-booking-experience.tsx");
        const bookingEmail = read("src/features/booking/lib/booking-emails.ts");
        assert.match(source, /appointment_reminder/);
        assert.match(source, /post_session_followup/);
        assert.match(source, /failedDeliveriesRetried/);
        assert.match(source, /emailDeliveryStatus/);
        assert.match(source, /emailDelivery: bookingEmailDelivery/);
        assert.match(source, /remindersSent \+= deliveryOutcome\.sent/);
        assert.doesNotMatch(source, /remindersSent \+= 1/);
        assert.match(source, /dueWindow\(REMINDER_WINDOWS, msUntilDeadline\)/);
        assert.match(source, /dueWindow\(APPOINTMENT_WINDOWS, msUntilStart\)/);
        assert.doesNotMatch(source, /\.in\("delivery_status", \["failed", "skipped", "bounced"\]\)/);
        assert.doesNotMatch(source, /2 \* HOUR_MS\)\.toISOString\(\)\s*\)\s*\.limit\(500\)/);
        assert.match(bookingForm, /metadata: \{\s*locale,/);
        assert.match(bookingEmail, /calendar\.google\.com\/calendar\/render/);
        assert.match(bookingEmail, /outlook\.live\.com\/calendar/);
    });

    it("ships forward-only schema for inquiry/outbox and the complete booking event set", () => {
        const outboxMigration = read("supabase/migrations/20260729120000_core_transactional_email_lifecycle.sql");
        const bookingMigration = read("supabase/migrations/20260729123000_core_booking_email_lifecycle_events.sql");
        assert.match(outboxMigration, /CREATE TABLE IF NOT EXISTS public\.contact_inquiries/);
        assert.match(outboxMigration, /CREATE TABLE IF NOT EXISTS public\.transactional_email_jobs/);
        assert.match(outboxMigration, /UNIQUE \(workspace_id, idempotency_key\)/);
        assert.match(outboxMigration, /pg_get_constraintdef\(constraint_row\.oid\) = 'UNIQUE \(idempotency_key\)'/);
        assert.doesNotMatch(outboxMigration, /idempotency_key text NOT NULL UNIQUE/);
        assert.match(outboxMigration, /REVOKE ALL ON TABLE public\.contact_inquiries FROM anon, authenticated/);
        assert.match(outboxMigration, /REVOKE ALL ON TABLE public\.transactional_email_jobs FROM anon, authenticated/);
        assert.match(outboxMigration, /REVOKE ALL ON TABLE public\.contact_inquiries FROM PUBLIC/);
        assert.match(outboxMigration, /REVOKE ALL ON TABLE public\.transactional_email_jobs FROM PUBLIC/);
        assert.doesNotMatch(outboxMigration, /can_access_workspace\(workspace_id, NULL\)/);
        for (const event of [
            "reservation_rescheduled",
            "reservation_reschedule_requested",
            "reservation_no_show",
            "payment_failed",
            "payment_refunded",
            "appointment_reminder",
            "post_session_followup",
        ]) {
            assert.match(bookingMigration, new RegExp(`'${event}'`), event);
        }
    });

    it("claims outbox jobs atomically and recovers abandoned running claims", () => {
        const source = read("src/features/communications/transactional-email.ts");
        const outboxMigration = read("supabase/migrations/20260729120000_core_transactional_email_lifecycle.sql");

        assert.match(source, /isClaimableDelivery/);
        assert.match(source, /\.eq\("status", job\.status\)/);
        assert.match(source, /\.eq\("attempts", job\.attempts\)/);
        assert.equal(source.match(/\.eq\("workspace_id", input\.workspaceId\)/g)?.length, 2);
        assert.match(source, /idempotencyKey: `transactional-email:\$\{job\.id\}`/);
        assert.match(source, /\.select\("id"\)/);
        assert.match(source, /\.in\("status", getTransactionalWebhookSourceStatuses\(status\)\)/);
        assert.ok((source.match(/\.eq\("status", "running"\)/g)?.length ?? 0) >= 4);
        assert.match(source, /\.eq\("status", "running"\)/);
        assert.match(source, /\.lte\("updated_at", staleBefore\)/);
        assert.match(outboxMigration, /transactional_email_jobs_running_lease_idx/);
    });

    it("dispatches atomic contact jobs from durable rows without recreating them", () => {
        const source = read("src/features/communications/transactional-email.ts");
        const start = source.indexOf("export async function dispatchTransactionalEmailJobsByIdempotencyKeys");
        const end = source.indexOf("export async function runTransactionalEmailDispatchCycle", start);
        const targetedDispatch = source.slice(start, end);

        assert.ok(start >= 0, "targeted durable dispatch helper is exported");
        assert.match(targetedDispatch, /\.in\("idempotency_key", idempotencyKeys\)/);
        assert.match(targetedDispatch, /dispatchJob/);
        assert.doesNotMatch(targetedDispatch, /\.insert\(/);
    });

    it("keeps generated contact types aligned with the atomic RPC", () => {
        const types = read("src/shared/lib/supabase/database.types.ts");
        assert.match(types, /contact_inquiries: \{[\s\S]*?submission_fingerprint: string \| null[\s\S]*?submission_id: string/);
        assert.match(types, /submit_contact_inquiry_with_email_jobs: \{[\s\S]*?p_email_jobs: Json[\s\S]*?p_inquiry: Json[\s\S]*?p_submission_fingerprint: string[\s\S]*?p_submission_id: string[\s\S]*?p_workspace_id: string/);
        assert.match(types, /Returns: \{\s*created: boolean\s*inquiry_id: string\s*\}\[\]/);
    });
});
