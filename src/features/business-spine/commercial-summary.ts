import type { BusinessCommercialLink, BusinessTimelineEvent } from "@/features/business-spine/types";

export type AccountCommercialSummary = {
    totalCommercialLinks: number;
    linkCountsByType: Record<string, number>;
    invoiceLinkCount: number;
    paymentLinkCount: number;
    invoiceStatusCounts: Record<string, number>;
    paymentEventCounts: Record<string, number>;
    lastCommercialActivityAt: string | null;
};

const INVOICE_TIMELINE_PREFIX = "legal.invoice_";
const PAYMENT_TIMELINE_PREFIX = "payment.";

function latestTimestamp(current: string | null, candidate: string | null | undefined) {
    if (!candidate) return current;
    if (!current) return candidate;
    return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
}

function increment(counts: Record<string, number>, key: string) {
    counts[key] = (counts[key] ?? 0) + 1;
}

export function deriveAccountCommercialSummary(input: {
    commercialLinks: BusinessCommercialLink[];
    timeline: Pick<BusinessTimelineEvent, "eventType" | "occurredAt">[];
}): AccountCommercialSummary {
    const linkCountsByType: Record<string, number> = {};
    const invoiceStatusCounts: Record<string, number> = {};
    const paymentEventCounts: Record<string, number> = {};
    let invoiceLinkCount = 0;
    let paymentLinkCount = 0;
    let lastCommercialActivityAt: string | null = null;

    for (const link of input.commercialLinks) {
        increment(linkCountsByType, link.linkType);
        if (link.linkedRecordType === "legal_invoice" || link.linkType === "agreement_invoice") {
            invoiceLinkCount += 1;
        }
        if (link.linkedRecordType === "booking_payment" || link.linkType === "invoice_payment" || link.linkType === "booking_payment") {
            paymentLinkCount += 1;
        }
        lastCommercialActivityAt = latestTimestamp(lastCommercialActivityAt, link.createdAt);
    }

    for (const event of input.timeline) {
        if (event.eventType.startsWith(INVOICE_TIMELINE_PREFIX)) {
            increment(invoiceStatusCounts, event.eventType.slice(INVOICE_TIMELINE_PREFIX.length));
            lastCommercialActivityAt = latestTimestamp(lastCommercialActivityAt, event.occurredAt);
        }
        if (event.eventType.startsWith(PAYMENT_TIMELINE_PREFIX)) {
            increment(paymentEventCounts, event.eventType.slice(PAYMENT_TIMELINE_PREFIX.length));
            lastCommercialActivityAt = latestTimestamp(lastCommercialActivityAt, event.occurredAt);
        }
    }

    return {
        totalCommercialLinks: input.commercialLinks.length,
        linkCountsByType,
        invoiceLinkCount,
        paymentLinkCount,
        invoiceStatusCounts,
        paymentEventCounts,
        lastCommercialActivityAt,
    };
}

export type WorkspaceCommercialAggregate = {
    totalCommercialLinks: number;
    activeInvoiceLinks: number;
    activePaymentLinks: number;
    recentLinks: BusinessCommercialLink[];
};

export async function getWorkspaceCommercialSummary(workspaceId: string): Promise<WorkspaceCommercialAggregate> {
    const { createClient } = await import("@/shared/lib/supabase/server");
    const supabase = await createClient();

    const { data: rows, error } = await supabase
        .from("workspace_commercial_links" as never)
        .select("*" as never)
        .eq("workspace_id" as never, workspaceId as never)
        .order("created_at" as never, { ascending: false })
        .limit(1000) as unknown as { data: Record<string, unknown>[] | null; error: unknown };

    if (error || !rows) {
        return {
            totalCommercialLinks: 0,
            activeInvoiceLinks: 0,
            activePaymentLinks: 0,
            recentLinks: [],
        };
    }

    let invoiceLinks = 0;
    let paymentLinks = 0;

    for (const row of rows) {
        if (row.linked_record_type === "legal_invoice" || row.link_type === "agreement_invoice") {
            invoiceLinks += 1;
        }
        if (row.linked_record_type === "booking_payment" || row.link_type === "invoice_payment" || row.link_type === "booking_payment") {
            paymentLinks += 1;
        }
    }

    return {
        totalCommercialLinks: rows.length,
        activeInvoiceLinks: invoiceLinks,
        activePaymentLinks: paymentLinks,
        recentLinks: rows.slice(0, 50).map(row => ({
            id: String(row.id || ""),
            customerId: row.customer_id ? String(row.customer_id) : null,
            linkType: String(row.link_type || ""),
            linkedRecordType: String(row.linked_record_type || ""),
            linkedRecordId: row.linked_record_id ? String(row.linked_record_id) : null,
            linkedRecordRef: row.linked_record_ref ? String(row.linked_record_ref) : null,
            createdAt: String(row.created_at || row.createdAt || new Date().toISOString()),
        })),
    };
}
