import { classifySourceFetchFailure, type SourceFetchFailureClassification, type SourceHealthStatus } from "../src/features/source-intelligence/ingestion";
import { createAdminClient } from "../src/shared/lib/supabase/admin";
import { assertSourceIntelligenceSupabaseTarget, loadSourceIntelligenceEnv } from "./source-intelligence-env";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_LIMIT = 200;
const USER_AGENT = "Platform Source Registry Health Audit/1.0";

type AuditOptions = {
    help: boolean;
    apply: boolean;
    includeInactive: boolean;
    workspaceId: string | null;
    registryId: string | null;
    limit: number;
    timeoutMs: number;
};

type RegistryAuditRow = {
    id: string;
    workspace_id: string | null;
    name: string;
    canonical_url: string;
    is_active: boolean;
    metadata: unknown;
};

type AuditResult = {
    id: string;
    name: string;
    url: string;
    ok: boolean;
    classification: SourceFetchFailureClassification | "healthy";
    source_health_status: SourceHealthStatus;
    http_status: number | null;
    final_url: string | null;
    content_type: string | null;
    message: string | null;
    checked_at: string;
};

function parseInteger(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv: string[]): AuditOptions {
    const options: AuditOptions = {
        help: false,
        apply: false,
        includeInactive: false,
        workspaceId: null,
        registryId: null,
        limit: DEFAULT_LIMIT,
        timeoutMs: DEFAULT_TIMEOUT_MS,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const [flag, inlineValue] = arg.split("=", 2);
        const nextValue = inlineValue ?? argv[index + 1];

        if (arg === "--help" || arg === "-h") options.help = true;
        else if (arg === "--apply") options.apply = true;
        else if (arg === "--include-inactive") options.includeInactive = true;
        else if (flag === "--workspace" || flag === "--workspace-id") {
            options.workspaceId = nextValue?.trim() || null;
            if (!inlineValue) index += 1;
        } else if (flag === "--registry" || flag === "--registry-id") {
            options.registryId = nextValue?.trim() || null;
            if (!inlineValue) index += 1;
        } else if (flag === "--limit") {
            options.limit = Math.min(parseInteger(nextValue, options.limit), 500);
            if (!inlineValue) index += 1;
        } else if (flag === "--timeout-ms") {
            options.timeoutMs = Math.min(parseInteger(nextValue, options.timeoutMs), 45_000);
            if (!inlineValue) index += 1;
        }
    }

    return options;
}

function printHelp() {
    console.log(`Source registry health audit

Usage:
  npm run audit:source-registry-health -- [--workspace <id>] [--registry <id>] [--limit 200] [--timeout-ms 15000] [--apply]

Behavior:
  - Reads active source_registry rows through the server-side Supabase service client.
  - Fetches registry URLs with timeout and structured failure classification.
  - Prints JSONL audit results and a final summary.
  - Does not mutate the database unless --apply is explicitly provided.
  - --apply updates health metadata and optional iSystem health columns only; it does not deactivate or delete sources.

Examples:
  npm run audit:source-registry-health -- --limit 20
  npm run audit:source-registry-health -- --workspace 00000000-0000-0000-0000-000000000000
  npm run audit:source-registry-health -- --registry 00000000-0000-0000-0000-000000000000 --apply
`);
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function healthStatusForClassification(classification: SourceFetchFailureClassification | "healthy"): SourceHealthStatus {
    if (classification === "healthy") return "healthy";
    if (classification === "missing") return "missing";
    if (classification === "blocked" || classification === "unauthorized" || classification === "non_text") return "blocked";
    if (classification === "rate_limited") return "rate_limited";
    if (classification === "network" || classification === "timeout") return "degraded";
    return "unknown";
}

function isTextualContentType(contentType: string | null): boolean {
    if (!contentType) return true;
    if (/^(text\/|application\/(?:json|ld\+json|xml|rss\+xml|atom\+xml|xhtml\+xml)|.+\+xml\b)/i.test(contentType)) return true;
    return /\b(html|xml|rss|atom|json)\b/i.test(contentType);
}

async function auditUrl(row: RegistryAuditRow, timeoutMs: number): Promise<AuditResult> {
    const checkedAt = new Date().toISOString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(row.canonical_url, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: {
                accept: "text/html,application/rss+xml,application/atom+xml,application/xml,text/plain;q=0.9,*/*;q=0.3",
                "user-agent": USER_AGENT,
            },
        });
        const contentType = response.headers.get("content-type");
        const classification: SourceFetchFailureClassification | "healthy" = response.ok && isTextualContentType(contentType)
            ? "healthy"
            : classifySourceFetchFailure({ status: response.status, contentType, message: response.statusText });
        return {
            id: row.id,
            name: row.name,
            url: row.canonical_url,
            ok: classification === "healthy",
            classification,
            source_health_status: healthStatusForClassification(classification),
            http_status: response.status,
            final_url: response.url,
            content_type: contentType,
            message: classification === "healthy" ? null : `HTTP ${response.status} ${response.statusText}`,
            checked_at: checkedAt,
        };
    } catch (error) {
        const err = error as { name?: string; message?: string };
        const classification = classifySourceFetchFailure({ errorName: err.name ?? null, message: err.message ?? null });
        return {
            id: row.id,
            name: row.name,
            url: row.canonical_url,
            ok: false,
            classification,
            source_health_status: healthStatusForClassification(classification),
            http_status: null,
            final_url: null,
            content_type: null,
            message: err.message ?? "Network failure",
            checked_at: checkedAt,
        };
    } finally {
        clearTimeout(timeout);
    }
}

function buildMetadata(row: RegistryAuditRow, result: AuditResult) {
    const metadata = asRecord(row.metadata);
    const previousHealth = asRecord(metadata.source_health);
    const failureCount = result.ok ? 0 : Number(previousHealth.failure_count ?? 0) + 1;
    return {
        ...metadata,
        source_health: {
            ...previousHealth,
            status: result.source_health_status,
            last_checked_at: result.checked_at,
            last_success_at: result.ok ? result.checked_at : previousHealth.last_success_at ?? null,
            last_failure_at: result.ok ? previousHealth.last_failure_at ?? null : result.checked_at,
            last_http_status: result.http_status,
            last_content_type: result.content_type,
            final_url: result.final_url,
            last_error_classification: result.ok ? null : result.classification,
            last_error_message: result.ok ? null : result.message,
            failure_count: failureCount,
            disabled_reason: result.ok ? null : ["missing", "blocked", "unauthorized", "non_text"].includes(result.classification) ? result.classification : null,
        },
    };
}

async function applyResult(row: RegistryAuditRow, result: AuditResult) {
    const supabase = createAdminClient();
    const update = {
        metadata: buildMetadata(row, result),
        source_health_status: result.source_health_status,
        last_fetch_status: result.http_status,
        last_fetch_error_classification: result.ok ? null : result.classification,
        last_fetch_checked_at: result.checked_at,
        disabled_reason: result.ok ? null : ["missing", "blocked", "unauthorized", "non_text"].includes(result.classification) ? result.classification : null,
    };

    const { error } = await supabase.from("source_registry" as never).update(update as never).eq("id" as never, row.id as never);
    if (!error) return;

    if (/source_health_status|last_fetch_status|last_fetch_error_classification|last_fetch_checked_at|disabled_reason/i.test(error.message)) {
        const { error: metadataOnlyError } = await supabase
            .from("source_registry" as never)
            .update({ metadata: update.metadata } as never)
            .eq("id" as never, row.id as never);
        if (metadataOnlyError) throw new Error(metadataOnlyError.message);
        return;
    }

    throw new Error(error.message);
}

async function listRegistryRows(options: AuditOptions): Promise<RegistryAuditRow[]> {
    const supabase = createAdminClient();
    let query = supabase
        .from("source_registry" as never)
        .select("id,workspace_id,name,canonical_url,is_active,metadata" as never)
        .order("updated_at" as never, { ascending: false })
        .limit(options.limit);

    if (!options.includeInactive) query = query.eq("is_active" as never, true as never);
    if (options.workspaceId) query = query.eq("workspace_id" as never, options.workspaceId as never);
    if (options.registryId) query = query.eq("id" as never, options.registryId as never);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list source registry rows: ${error.message}`);
    return (data as RegistryAuditRow[] | null) ?? [];
}

async function main() {
    loadSourceIntelligenceEnv();
    assertSourceIntelligenceSupabaseTarget();
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const rows = await listRegistryRows(options);
    const counts: Record<string, number> = {};
    let applied = 0;

    for (const row of rows) {
        const result = await auditUrl(row, options.timeoutMs);
        counts[result.classification] = (counts[result.classification] ?? 0) + 1;
        if (options.apply) {
            await applyResult(row, result);
            applied += 1;
        }
        console.log(JSON.stringify({ event: "source_registry_health_audit_result", applied: options.apply, ...result }));
    }

    console.log(JSON.stringify({
        event: "source_registry_health_audit_summary",
        ok: true,
        dry_run: !options.apply,
        checked: rows.length,
        applied,
        counts,
        timestamp: new Date().toISOString(),
    }));
}

main().catch((error) => {
    console.error(JSON.stringify({
        event: "source_registry_health_audit_summary",
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected audit failure",
        timestamp: new Date().toISOString(),
    }));
    process.exitCode = 1;
});
