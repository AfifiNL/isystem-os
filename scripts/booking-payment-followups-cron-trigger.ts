import { recordCronWrapperHealth } from "./lib/cron-health";
import { getSiteUrl } from "../src/shared/lib/site-url";

const ENDPOINT_PATH = "/api/booking/payment-followups";

function parseArgs(argv: string[]) {
    const options = {
        dryRun: false,
        url: process.env.BOOKING_PAYMENT_FOLLOWUP_CRON_URL?.trim() || null as string | null,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const [flag, inlineValue] = arg.split("=", 2);
        const nextValue = inlineValue ?? argv[index + 1];
        if (arg === "--dry-run") options.dryRun = true;
        else if (flag === "--url") {
            options.url = nextValue?.trim() || null;
            if (!inlineValue) index += 1;
        }
    }
    return options;
}

function resolveEndpoint(configured: string | null) {
    const base = configured
        || process.env.NEXT_PUBLIC_SITE_URL?.trim()
        || process.env.APP_URL?.trim()
        || getSiteUrl();
    const url = new URL(base);
    if (!url.pathname.endsWith(ENDPOINT_PATH)) {
        url.pathname = `${url.pathname.replace(/\/$/, "")}${ENDPOINT_PATH}`;
    }
    url.search = "";
    url.hash = "";
    return url.toString();
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const endpoint = resolveEndpoint(options.url);
    const secret = process.env.BOOKING_PAYMENT_FOLLOWUP_SECRET?.trim() || process.env.CRON_SECRET?.trim();
    const startedAt = Date.now();

    if (options.dryRun) {
        console.log(JSON.stringify({
            event: "booking_payment_followups_cron_trigger_dry_run",
            ok: true,
            timestamp: new Date().toISOString(),
            endpoint,
            has_secret: Boolean(secret),
        }));
        return;
    }

    if (!secret) {
        await recordCronWrapperHealth({
            integrationKey: "booking-payment-followups",
            status: "failing",
            message: "Booking payment follow-up cron wrapper is missing its bearer secret.",
            errorCode: "missing_secret",
            details: { endpoint },
        });
        console.error(JSON.stringify({
            event: "booking_payment_followups_cron_trigger",
            ok: false,
            timestamp: new Date().toISOString(),
            endpoint,
            error: "BOOKING_PAYMENT_FOLLOWUP_SECRET is required.",
        }));
        process.exitCode = 1;
        return;
    }

    let response: Response;
    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: {
                authorization: `Bearer ${secret}`,
                "content-type": "application/json",
                "user-agent": "platform-booking-payment-followups-cron/1.0",
            },
        });
    } catch (error) {
        await recordCronWrapperHealth({
            integrationKey: "booking-payment-followups",
            status: "failing",
            message: error instanceof Error ? error.message : "Booking payment follow-up cron network failure.",
            latencyMs: Date.now() - startedAt,
            statusCode: 0,
            errorCode: "network_failure",
            details: { endpoint },
        });
        console.error(JSON.stringify({
            event: "booking_payment_followups_cron_trigger",
            ok: false,
            status: 0,
            timestamp: new Date().toISOString(),
            endpoint,
            error: error instanceof Error ? error.message : "Network failure",
        }));
        process.exitCode = 1;
        return;
    }

    const body = await response.json().catch(() => ({ ok: false, error: "Non-JSON response" })) as Record<string, unknown>;
    const routeHealth = body.health === "healthy" || body.health === "degraded" || body.health === "failing"
        ? body.health
        : response.status === 207 ? "degraded" : response.ok ? "healthy" : "failing";
    const ok = response.ok && body.ok !== false && routeHealth === "healthy";
    const stuck_payments_count = typeof body.stuckPaymentsCount === "number" ? body.stuckPaymentsCount : 0;
    const commercial_artifact_error_count = Array.isArray(body.commercialArtifactErrors)
        ? body.commercialArtifactErrors.length
        : 0;
    const summary = {
        event: "booking_payment_followups_cron_trigger",
        ok,
        status: response.status,
        health: routeHealth,
        timestamp: new Date().toISOString(),
        reminders_sent: typeof body.remindersSent === "number" ? body.remindersSent : 0,
        expired_count: typeof body.expiredCount === "number" ? body.expiredCount : 0,
        expiry_emails_sent: typeof body.expiryEmailsSent === "number" ? body.expiryEmailsSent : 0,
        commercial_artifacts_reconciled: typeof body.commercialArtifactsReconciled === "number"
            ? body.commercialArtifactsReconciled
            : 0,
        commercial_bookings_confirmed: typeof body.commercialBookingsConfirmed === "number"
            ? body.commercialBookingsConfirmed
            : 0,
        // Reconciliation and stuck-payment detection span workspaces. Keep
        // cron health tenant-safe by reporting only aggregate counts, never
        // payment IDs, booking references, or reconciliation error text.
        commercial_artifact_error_count,
        stuck_payments_count,
        error: typeof body.error === "string" ? body.error : null,
    };

    let healthStatus: "healthy" | "degraded" | "failing" = "healthy";
    if (routeHealth === "failing") {
        healthStatus = "failing";
    } else if (routeHealth === "degraded" || commercial_artifact_error_count > 0 || stuck_payments_count > 0) {
        healthStatus = "degraded";
    }

    const healthMessage = !ok
        ? (summary.error ?? `Booking payment follow-up cron returned HTTP ${response.status}.`)
        : commercial_artifact_error_count > 0
            ? `Booking payment followups ran with ${commercial_artifact_error_count} commercial artifact reconciliation error(s).`
            : stuck_payments_count > 0
                ? `Booking payment followups ran. Found ${stuck_payments_count} stuck payments that require attention.`
            : `Booking payment follow-up cron completed. Sent ${summary.reminders_sent} reminder(s).`;

    const healthErrorCode = !ok
        ? "booking_payment_followups_failed"
        : commercial_artifact_error_count > 0
            ? "commercial_artifact_reconciliation_failed"
            : stuck_payments_count > 0
                ? "stuck_payments_detected"
                : null;

    await recordCronWrapperHealth({
        integrationKey: "booking-payment-followups",
        status: healthStatus,
        message: healthMessage,
        latencyMs: Date.now() - startedAt,
        statusCode: response.status,
        errorCode: healthErrorCode,
        details: { endpoint, ...summary },
    });

    const line = JSON.stringify(summary);
    if (!ok) {
        console.error(line);
        process.exitCode = 1;
        return;
    }
    console.log(line);
}

main().catch((error) => {
    console.error(JSON.stringify({
        event: "booking_payment_followups_cron_trigger",
        ok: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unexpected failure",
    }));
    process.exitCode = 1;
});
