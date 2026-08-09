import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/shared/lib/supabase/database.types";

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired" | "converted" | "void";

export type CommercialLinkType =
    | "booking_quote"
    | "booking_agreement"
    | "agreement_invoice"
    | "invoice_payment"
    | "booking_payment"
    | "payment_accounting_entry"
    | "quote_credit_note"
    | "quote_adjustment";

const FINAL_QUOTE_STATUSES = new Set<QuoteStatus>(["accepted", "converted", "void"]);

type SupabaseLike = SupabaseClient;

export function isFinalQuoteStatus(status: QuoteStatus) {
    return FINAL_QUOTE_STATUSES.has(status);
}

export function assertQuoteMutationAllowed(input: {
    currentStatus: QuoteStatus;
    nextStatus?: QuoteStatus;
    mutationKind: "content" | "status_transition" | "correction_link";
}) {
    if (!isFinalQuoteStatus(input.currentStatus)) return { allowed: true as const };

    if (input.mutationKind === "correction_link") return { allowed: true as const };

    const allowedFinalTransitions: Array<[QuoteStatus, QuoteStatus]> = [
        ["accepted", "converted"],
        ["accepted", "void"],
        ["converted", "void"],
    ];
    const transitionAllowed = input.nextStatus
        ? allowedFinalTransitions.some(([from, to]) => from === input.currentStatus && to === input.nextStatus)
        : false;

    if (input.mutationKind === "status_transition" && transitionAllowed) {
        return { allowed: true as const };
    }

    return {
        allowed: false as const,
        error: "Finalized quotes are immutable. Create a credit note or adjustment link instead.",
    };
}

export function buildCommercialLinkIdempotencyKey(input: {
    linkType: CommercialLinkType;
    linkedRecordType: string;
    linkedRecordId?: string | null;
    linkedRecordRef?: string | null;
    quoteId?: string | null;
}) {
    const target = input.linkedRecordId ?? input.linkedRecordRef;
    return [
        "commercial-link",
        input.linkType,
        input.quoteId ?? "no-quote",
        input.linkedRecordType,
        target ?? "no-target",
    ].join(":");
}

function getServiceRoleClient(): SupabaseClient | null {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceRoleKey) return null;
    return createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

export async function upsertCommercialLink(input: {
    supabase?: SupabaseLike;
    workspaceId: string;
    customerId?: string | null;
    quoteId?: string | null;
    linkType: CommercialLinkType;
    linkedRecordType: string;
    linkedRecordId?: string | null;
    linkedRecordRef?: string | null;
    metadata?: Record<string, unknown>;
}) {
    if (!input.linkedRecordId && !input.linkedRecordRef) {
        return { success: false as const, error: "A commercial link target is required." };
    }

    const supabase = input.supabase ?? getServiceRoleClient();
    if (!supabase) {
        return { success: false as const, error: "Missing Supabase service-role configuration." };
    }

    const idempotencyKey = buildCommercialLinkIdempotencyKey({
        linkType: input.linkType,
        linkedRecordType: input.linkedRecordType,
        linkedRecordId: input.linkedRecordId,
        linkedRecordRef: input.linkedRecordRef,
        quoteId: input.quoteId,
    });

    const { data, error } = await supabase
        .from("workspace_commercial_links" as never)
        .upsert({
            workspace_id: input.workspaceId,
            customer_id: input.customerId ?? null,
            quote_id: input.quoteId ?? null,
            link_type: input.linkType,
            linked_record_type: input.linkedRecordType,
            linked_record_id: input.linkedRecordId ?? null,
            linked_record_ref: input.linkedRecordRef ?? null,
            idempotency_key: idempotencyKey,
            metadata: (input.metadata ?? {}) as Json,
        } as never, { onConflict: "workspace_id,idempotency_key" } as never)
        .select("id" as never)
        .single() as unknown as { data: { id: string } | null; error: { message: string } | null };

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: { id: data?.id ?? null, idempotencyKey } };
}

export async function linkBookingToAgreement(input: {
    supabase?: SupabaseLike;
    workspaceId: string;
    bookingId: string;
    agreementId: string;
    customerId?: string | null;
    metadata?: Record<string, unknown>;
}) {
    return upsertCommercialLink({
        supabase: input.supabase,
        workspaceId: input.workspaceId,
        customerId: input.customerId ?? null,
        linkType: "booking_agreement",
        linkedRecordType: "legal_agreement",
        linkedRecordId: input.agreementId,
        linkedRecordRef: input.bookingId,
        metadata: {
            bookingId: input.bookingId,
            ...(input.metadata ?? {}),
        },
    });
}

export async function linkAgreementToInvoice(input: {
    supabase?: SupabaseLike;
    workspaceId: string;
    invoiceId: string;
    agreementId?: string | null;
    customerId?: string | null;
    invoiceNumber?: string | null;
    metadata?: Record<string, unknown>;
}) {
    return upsertCommercialLink({
        supabase: input.supabase,
        workspaceId: input.workspaceId,
        customerId: input.customerId ?? null,
        linkType: "agreement_invoice",
        linkedRecordType: "legal_invoice",
        linkedRecordId: input.invoiceId,
        linkedRecordRef: input.agreementId ?? input.invoiceNumber ?? undefined,
        metadata: {
            invoiceId: input.invoiceId,
            agreementId: input.agreementId ?? null,
            invoiceNumber: input.invoiceNumber ?? null,
            ...(input.metadata ?? {}),
        },
    });
}

export async function linkQuoteCorrection(input: {
    workspaceId: string;
    quoteId: string;
    correctionType: "credit_note" | "adjustment";
    linkedRecordType: string;
    linkedRecordId?: string | null;
    linkedRecordRef?: string | null;
    metadata?: Record<string, unknown>;
}) {
    return upsertCommercialLink({
        workspaceId: input.workspaceId,
        quoteId: input.quoteId,
        linkType: input.correctionType === "credit_note" ? "quote_credit_note" : "quote_adjustment",
        linkedRecordType: input.linkedRecordType,
        linkedRecordId: input.linkedRecordId ?? null,
        linkedRecordRef: input.linkedRecordRef ?? null,
        metadata: input.metadata,
    });
}
