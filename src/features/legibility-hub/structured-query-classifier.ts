import type { ClassifiedLegibilityQuery, LegibilityQueryMode, StructuredHubQueryKey } from "./structured-query-types";

interface PatternRule {
    key: StructuredHubQueryKey;
    mode?: LegibilityQueryMode;
    confidence: number;
    reason: string;
    patterns: RegExp[];
}

const EXACT_WORDS = /\b(how many|how much|count|number of|total|list|show me|which|what are)\b/i;
const SEMANTIC_WORDS = /\b(summarize|summary|what did|discuss|discussed|mention|mentioned|context|why|explain|find context|meeting|call notes?|recent discussion)\b/i;
const GLOBAL_SCOPE_WORDS = /\b(all workspaces|across workspaces|every workspace|global|cross[-\s]?workspace|tenant boundaries|all tenants)\b/i;
const PROMPT_INJECTION_WORDS = /\b(ignore previous|ignore all|developer message|system prompt|reveal prompt|show.*schema|database schema|service role|secret|api key)\b/i;

const STRUCTURED_PATTERNS: PatternRule[] = [
    {
        key: "failing_integration_list",
        confidence: 0.95,
        reason: "Matched failing/degraded integration health wording.",
        patterns: [/\b(which|what|show|list)\b.*\b(integrations?|connectors?|providers?|workers?|cron)\b.*\b(failing|failed|degraded|unhealthy|broken)\b/i, /\b(which|what|show|list)\b.*\b(failing|failed|degraded|unhealthy|broken)\b.*\b(integrations?|connectors?|providers?|workers?|cron)\b/i, /\b(failing|failed|degraded|unhealthy|broken)\b.*\b(integrations?|connectors?|providers?|workers?|cron)\b/i, /\b(integrations?|connectors?|providers?|workers?|cron)\b.*\b(failing|failed|degraded|unhealthy|broken)\b/i],
    },
    {
        key: "blocked_work_item_list",
        confidence: 0.94,
        reason: "Matched blocked Business Spine work item wording.",
        patterns: [/\b(which|what|show|list)\b.*\b(blocked)\b.*\b(work items?|tasks?|ops items?)\b/i, /\b(which|what|show|list)\b.*\b(work items?|tasks?|ops items?)\b.*\b(blocked)\b/i, /\b(blocked)\b.*\b(work items?|tasks?|ops items?)\b/i, /\b(work items?|tasks?|ops items?)\b.*\b(blocked)\b/i],
    },
    {
        key: "open_work_item_list",
        confidence: 0.9,
        reason: "Matched open Business Spine work item wording.",
        patterns: [/\b(which|what|show|list)\b.*\b(open|in progress|active)\b.*\b(work items?|tasks?|ops items?)\b/i, /\b(which|what|show|list)\b.*\b(work items?|tasks?|ops items?)\b.*\b(open|in progress|active)\b/i, /\b(open|in progress|active)\b.*\b(work items?|tasks?|ops items?)\b/i, /\b(work items?|tasks?|ops items?)\b.*\b(open|in progress|active)\b/i],
    },
    {
        key: "recent_failed_workflow_run_list",
        confidence: 0.92,
        reason: "Matched recent workflow failure wording.",
        patterns: [/\b(recent|latest|last)\b.*\b(workflow|automation)\b.*\b(failures?|failed|retrying|errors?)\b/i, /\b(workflow|automation)\b.*\b(failures?|failed|retrying|errors?)\b/i],
    },
    {
        key: "customer_lifecycle_counts",
        confidence: 0.9,
        reason: "Matched Business Spine customer lifecycle wording.",
        patterns: [/\bhow many\b.*\b(customers?|accounts?)\b.*\b(active|lead|prospect|qualified|paused|churned|lifecycle)\b/i, /\b(customers?|accounts?)\b.*\b(lifecycle|status breakdown|active|lead|prospect|qualified|paused|churned)\b/i],
    },
    {
        key: "overdue_sla_task_count",
        confidence: 0.93,
        reason: "Matched overdue SLA task metric wording.",
        patterns: [/\boverdue\b.*\b(sla|tasks?|schedules?)\b/i, /\b(sla|tasks?|schedules?)\b.*\boverdue\b/i, /\b(late|behind schedule|past due)\b.*\b(tasks?|sla)\b/i],
    },
    {
        key: "unresolved_sla_flags_count",
        confidence: 0.92,
        reason: "Matched unresolved SLA/client flag wording.",
        patterns: [/\bunresolved\b.*\b(flags?|client flags?)\b/i, /\b(flags?|client flags?)\b.*\b(unresolved|awaiting reply|open)\b/i, /\bawaiting reply\b/i],
    },
    {
        key: "unprocessed_voice_memo_count",
        confidence: 0.92,
        reason: "Matched unprocessed voice memo metric wording.",
        patterns: [/\bunprocessed\b.*\b(voice memos?|recordings?|calls?)\b/i, /\b(voice memos?|recordings?)\b.*\bunprocessed\b/i],
    },
    {
        key: "recent_voice_memo_count",
        confidence: 0.88,
        reason: "Matched date-window voice memo metric wording.",
        patterns: [/\b(voice memos?|recordings?|calls?)\b.*\b(today|this week|last week|this month|last month|last 7 days|last 30 days|recent)\b/i, /\b(today|this week|last week|this month|last month|last 7 days|last 30 days|recent)\b.*\b(voice memos?|recordings?|calls?)\b/i],
    },
    {
        key: "client_list",
        confidence: 0.9,
        reason: "Matched portal client list wording.",
        patterns: [
            /\b(list|show)\b.*\b(clients?|portal clients?|accounts?|partners?)\b/i,
            /\b(which|what are)\b.*\b(clients|portal clients|accounts|partners)\b/i,
            /\bclient names\b/i,
        ],
    },
    {
        key: "client_count",
        confidence: 0.94,
        reason: "Matched portal client count wording.",
        patterns: [/\bhow many\b.*\b(clients?|portal clients?|accounts?|partners?)\b/i, /\b(client|portal client|account|partner) count\b/i, /\bnumber of\b.*\b(clients?|portal clients?|accounts?|partners?)\b/i],
    },
    {
        key: "project_count",
        confidence: 0.9,
        reason: "Matched project/location count wording.",
        patterns: [/\bhow many\b.*\b(projects?|locations?|facilities|sites)\b/i, /\b(project|location|facility|site) count\b/i],
    },
    {
        key: "sla_task_count",
        confidence: 0.88,
        reason: "Matched SLA task count wording.",
        patterns: [/\bhow many\b.*\b(sla tasks?|schedules?|recurring tasks?)\b/i, /\b(sla task|schedule|recurring task) count\b/i],
    },
    {
        key: "published_content_count",
        confidence: 0.88,
        reason: "Matched published content count wording.",
        patterns: [/\bhow many\b.*\bpublished\b.*\b(content|posts?|pages?|articles?)\b/i, /\bpublished\b.*\b(content|posts?|pages?|articles?)\b.*\b(count|total|number)\b/i],
    },
    {
        key: "content_item_count",
        confidence: 0.82,
        reason: "Matched content item count wording.",
        patterns: [/\bhow many\b.*\b(content items?|content|posts?|pages?|articles?)\b/i, /\bcontent\b.*\b(count|total|number)\b/i],
    },
    {
        key: "booking_reservation_count",
        confidence: 0.86,
        reason: "Matched booking/reservation count wording.",
        patterns: [/\bhow many\b.*\b(bookings?|reservations?|appointments?|requests?)\b/i, /\b(booking|reservation|appointment) count\b/i],
    },
    {
        key: "open_opportunity_count",
        confidence: 0.86,
        reason: "Matched open opportunity count wording.",
        patterns: [/\bhow many\b.*\b(open|pending|approved)?\s*opportunit/i, /\b(open|pending|approved)\b.*\bopportunit/i],
    },
    {
        key: "quote_status_counts",
        confidence: 0.9,
        reason: "Matched Business Spine quote wording.",
        patterns: [/\b(how many|what is the status of|show)\b.*\b(quotes?|estimates?)\b/i, /\b(quotes?|estimates?)\b.*\b(status|count|breakdown)\b/i],
    },
    {
        key: "invoice_status_counts",
        confidence: 0.9,
        reason: "Matched Business Spine invoice wording.",
        patterns: [/\b(how many|what is the status of|show)\b.*\b(invoices?|bills?)\b/i, /\b(invoices?|bills?)\b.*\b(status|count|breakdown|unpaid|paid)\b/i],
    },
    {
        key: "recent_customer_lifecycle_events",
        confidence: 0.92,
        reason: "Matched Business Spine customer timeline wording.",
        patterns: [/\b(recent|latest|show)\b.*\b(customer events?|lifecycle events?|customer activity)\b/i, /\b(customer events?|lifecycle events?|customer activity)\b/i],
    },
];

function normalizeLegibilityQuery(queryText: string) {
    return queryText.trim().replace(/\s+/g, " ");
}

function scoreRules(queryText: string) {
    return STRUCTURED_PATTERNS.flatMap((rule) => {
        const matched = rule.patterns.some((pattern) => pattern.test(queryText));
        return matched ? [{ key: rule.key, confidence: rule.confidence, reason: rule.reason }] : [];
    }).sort((a, b) => b.confidence - a.confidence);
}

export function classifyLegibilityQueryIntent(queryText: string): ClassifiedLegibilityQuery {
    const normalized = normalizeLegibilityQuery(queryText);
    const matches = scoreRules(normalized);
    const isExact = EXACT_WORDS.test(normalized);
    const wantsSemantic = SEMANTIC_WORDS.test(normalized);
    const wantsGlobalScope = GLOBAL_SCOPE_WORDS.test(normalized);
    const hasInjection = PROMPT_INJECTION_WORDS.test(normalized);

    if (wantsGlobalScope && isExact) {
        return {
            mode: "unsupported",
            structuredKey: matches[0]?.key,
            confidence: 0.9,
            reason: "global_scope_not_supported",
            alternatives: matches.slice(0, 3),
        };
    }

    if (matches.length > 1 && matches[0].confidence >= 0.75 && matches[1].confidence >= 0.75 && matches[0].key !== matches[1].key) {
        const first = matches[0];
        const second = matches[1];
        const gap = first.confidence - second.confidence;
        if (gap < 0.05) {
            return {
                mode: "unsupported",
                confidence: first.confidence,
                reason: "Multiple structured metrics matched. Clarification is required before running a deterministic query.",
                alternatives: matches.slice(0, 3),
                needsClarification: true,
            };
        }
    }

    const top = matches[0];
    if (top && top.confidence >= 0.75) {
        if (wantsSemantic && !hasInjection) {
            return {
                mode: "hybrid",
                structuredKey: top.key,
                confidence: Math.min(top.confidence, 0.86),
                reason: `${top.reason} The query also asks for contextual discussion, so hybrid mode is appropriate.`,
                alternatives: matches.slice(1, 4),
            };
        }

        return {
            mode: "structured",
            structuredKey: top.key,
            confidence: top.confidence,
            reason: top.reason,
            alternatives: matches.slice(1, 4),
        };
    }

    if (isExact) {
        return {
            mode: "unsupported",
            confidence: 0.62,
            reason: "The query asks for an exact metric, but no allowlisted structured metric matched confidently.",
            alternatives: matches.slice(0, 3),
        };
    }

    return {
        mode: "semantic",
        confidence: hasInjection ? 0.35 : 0.4,
        reason: hasInjection
            ? "Prompt-injection or schema/secret wording was ignored for routing; no structured metric matched. Falling back to scoped semantic retrieval."
            : "No deterministic structured metric matched confidently. Falling back to semantic retrieval.",
        alternatives: matches.slice(0, 3),
    };
}
