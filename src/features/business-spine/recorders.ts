import type { SupabaseClient } from "@supabase/supabase-js";
import { recordBusinessIntegrationEvent, recordBusinessIntegrationHealthCheck } from "@/features/business-spine/integrations";
import { linkAgreementToInvoice, upsertCommercialLink } from "@/features/business-spine/quote-to-cash";
import { dispatchRecorderWorkflowEvent } from "@/features/business-spine/workflow-events";
import {
    recordTimelineEvent,
    upsertCustomerForSignal,
    upsertWorkItem,
} from "@/features/business-spine/service";
import { resolveCanonicalCustomerId } from "@/features/business-spine/identity";

type SupabaseLike = SupabaseClient;

type CustomerSignal = {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    portalClientId?: string | null;
};

function displayName(signal: CustomerSignal, fallback: string) {
    return signal.name?.trim() || signal.email?.trim() || fallback;
}

async function bestEffort(label: string, fn: () => Promise<void>) {
    try {
        await fn();
    } catch (error) {
        console.warn(`[business-spine] ${label} recorder failed`, error);
    }
}

async function bestEffortWorkflow(input: Parameters<typeof dispatchRecorderWorkflowEvent>[0]) {
    const telemetry = await dispatchRecorderWorkflowEvent(input);
    if (telemetry && !telemetry.ok) {
        console.warn("[business-spine] workflow dispatch failed", {
            eventKey: telemetry.eventKey,
            idempotencyKey: telemetry.idempotencyKey,
            error: telemetry.error,
        });
    }
}

export async function recordContactBusinessEvent(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    inquiryId: string;
    contact: CustomerSignal;
    requestType?: string | null;
    company?: string | null;
    challenge?: string | null;
    requiresConfirmation?: boolean;
}) {
    await bestEffort("contact", async () => {
        const customerId = await upsertCustomerForSignal({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            displayName: displayName(input.contact, "Contact lead"),
            email: input.contact.email,
            phone: input.contact.phone,
            portalClientId: input.contact.portalClientId,
            sourceModule: "contact",
            lifecycleStatus: "lead",
            metadata: {
                inquiryId: input.inquiryId,
                requestType: input.requestType ?? null,
                company: input.company ?? null,
            },
        });

        await recordTimelineEvent({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            customerId,
            eventType: "contact.submitted",
            summary: input.requestType ? `Contact submitted: ${input.requestType}` : "Contact form submitted",
            sourceModule: "contact",
            sourceTable: "contact_inquiries",
            sourceId: input.inquiryId,
            idempotencyKey: `contact:${input.inquiryId}:submitted`,
            actorType: "public_visitor",
            payload: {
                company: input.company ?? null,
                challenge: input.challenge ?? null,
                requiresConfirmation: input.requiresConfirmation ?? null,
            },
        });

        await upsertWorkItem({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            customerId,
            title: `Follow up contact: ${displayName(input.contact, "new lead")}`,
            description: input.challenge ?? input.requestType ?? null,
            kind: "contact_follow_up",
            priority: "high",
            sourceModule: "contact",
            sourceEntityType: "contact_inquiry",
            sourceEntityId: input.inquiryId,
            idempotencyKey: `work:contact-follow-up:${input.inquiryId}`,
            metadata: { requestType: input.requestType ?? null },
        });
    });
    await bestEffortWorkflow({
        workspaceId: input.workspaceId,
        sourceModule: "contact",
        recorderEventKey: "contact.submitted",
        sourceEntityType: "contact_inquiry",
        sourceEntityId: input.inquiryId,
        payload: {
            inquiryId: input.inquiryId,
            requestType: input.requestType ?? null,
            company: input.company ?? null,
            challenge: input.challenge ?? null,
            requiresConfirmation: input.requiresConfirmation ?? null,
        },
        idempotencyValues: { inquiryId: input.inquiryId },
    });
}

export async function recordNewsletterBusinessEvent(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    eventType: "subscribed" | "confirmed" | "campaign_created" | "campaign_sent" | "bounced" | "complained";
    contact?: CustomerSignal;
    contactId?: string | null;
    campaignId?: string | null;
    providerEventId?: string | null;
    payload?: Record<string, unknown>;
}) {
    await bestEffort("newsletter", async () => {
        let customerId: string | null = null;
        if (input.contact?.email) {
            customerId = await upsertCustomerForSignal({
                supabase: input.supabase,
                workspaceId: input.workspaceId,
                displayName: displayName(input.contact, "Newsletter contact"),
                email: input.contact.email,
                sourceModule: "newsletter",
                lifecycleStatus: input.eventType === "confirmed" || input.eventType === "subscribed" ? "lead" : undefined,
                metadata: { contactId: input.contactId ?? null },
            });
        }
        await recordTimelineEvent({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            customerId,
            eventType: `newsletter.${input.eventType}`,
            summary: `Newsletter ${input.eventType.replace(/_/g, " ")}`,
            sourceModule: "newsletter",
            sourceTable: input.campaignId ? "newsletter_campaigns" : "newsletter_contacts",
            sourceId: input.campaignId ?? input.contactId ?? null,
            idempotencyKey: `newsletter:${input.eventType}:${input.providerEventId ?? input.campaignId ?? input.contactId ?? Date.now()}`,
            payload: input.payload,
        });
        await recordBusinessIntegrationEvent({
            workspaceId: input.workspaceId,
            provider: "resend",
            integrationKey: "email-delivery",
            eventType: `newsletter.${input.eventType}`,
            providerEventId: input.providerEventId ?? null,
            payload: input.payload,
        });
    });
    await bestEffortWorkflow({
        workspaceId: input.workspaceId,
        sourceModule: "newsletter",
        recorderEventKey: `newsletter.${input.eventType}`,
        sourceEntityType: input.campaignId ? "newsletter_campaign" : "newsletter_contact",
        sourceEntityId: input.campaignId ?? input.contactId ?? null,
        payload: {
            ...(input.payload ?? {}),
            contactId: input.contactId ?? null,
            campaignId: input.campaignId ?? null,
            providerEventId: input.providerEventId ?? null,
        },
        idempotencyValues: {
            providerEventId: input.providerEventId ?? undefined,
            contactId: input.contactId ?? undefined,
            campaignId: input.campaignId ?? undefined,
        },
    });
}

export async function recordOutreachBusinessEvent(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    eventType: "prospect_approved" | "contacted" | "replied" | "suppressed" | "converted";
    contact?: CustomerSignal;
    accountName?: string | null;
    campaignId?: string | null;
    contactId?: string | null;
    messageId?: string | null;
    payload?: Record<string, unknown>;
}) {
    await bestEffort("outreach", async () => {
        const customerId = await upsertCustomerForSignal({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            displayName: input.accountName ?? displayName(input.contact ?? {}, "Outreach prospect"),
            email: input.contact?.email,
            sourceModule: "outreach",
            lifecycleStatus: input.eventType === "converted" ? "customer" : input.eventType === "replied" ? "qualified" : "prospect",
            metadata: { campaignId: input.campaignId ?? null, outreachContactId: input.contactId ?? null },
        });
        await recordTimelineEvent({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            customerId,
            eventType: `outreach.${input.eventType}`,
            summary: `Outreach ${input.eventType.replace(/_/g, " ")}`,
            sourceModule: "outreach",
            sourceTable: input.messageId ? "outreach_messages" : "outreach_contacts",
            sourceId: input.messageId ?? input.contactId ?? null,
            idempotencyKey: `outreach:${input.eventType}:${input.messageId ?? input.contactId ?? input.campaignId ?? Date.now()}`,
            payload: input.payload,
        });
        if (input.eventType === "replied" || input.eventType === "converted") {
            await upsertWorkItem({
                supabase: input.supabase,
                workspaceId: input.workspaceId,
                customerId,
                title: input.eventType === "converted" ? "Confirm outreach conversion" : "Reply to outreach response",
                description: input.accountName ?? input.contact?.email ?? null,
                kind: input.eventType === "converted" ? "outreach_conversion" : "outreach_reply",
                priority: input.eventType === "converted" ? "high" : "normal",
                sourceModule: "outreach",
                sourceEntityType: input.messageId ? "outreach_message" : "outreach_contact",
                sourceEntityId: input.messageId ?? input.contactId ?? input.campaignId ?? "00000000-0000-0000-0000-000000000000",
                idempotencyKey: `work:outreach:${input.eventType}:${input.messageId ?? input.contactId ?? input.campaignId}`,
                metadata: input.payload,
            });
        }
    });
    await bestEffortWorkflow({
        workspaceId: input.workspaceId,
        sourceModule: "outreach",
        recorderEventKey: `outreach.${input.eventType}`,
        sourceEntityType: input.messageId ? "outreach_message" : "outreach_contact",
        sourceEntityId: input.messageId ?? input.contactId ?? null,
        payload: {
            ...(input.payload ?? {}),
            messageId: input.messageId ?? null,
            contactId: input.contactId ?? null,
            campaignId: input.campaignId ?? null,
            accountName: input.accountName ?? null,
        },
        idempotencyValues: {
            messageId: input.messageId ?? undefined,
            contactId: input.contactId ?? undefined,
            campaignId: input.campaignId ?? undefined,
        },
    });
}

export async function recordPaymentBusinessEvent(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    eventType: "approved" | "captured" | "refunded" | "failed" | "cancelled" | "captured_after_terminal";
    paymentId: string;
    bookingId?: string | null;
    customer?: CustomerSignal;
    amountCents?: number | null;
    currency?: string | null;
    providerEventId?: string | null;
    netAmountCents?: number | null;
    vatAmountCents?: number | null;
    vatRateBasisPoints?: number | null;
    grossAmountCents?: number | null;
    payload?: Record<string, unknown>;
}) {
    await bestEffort("payment", async () => {
        const paymentFactsResult = await input.supabase
            .from("booking_payments" as never)
            .select("reservation_id,net_amount_cents,vat_amount_cents,vat_rate_basis_points,gross_amount_cents,booking_reservations!booking_payments_workspace_reservation_fk ( customer_full_name, customer_email, customer_phone, portal_client_id )" as never)
            .eq("workspace_id" as never, input.workspaceId as never)
            .eq("id" as never, input.paymentId as never)
            .maybeSingle() as unknown as {
                data: {
                    reservation_id: string | null;
                    net_amount_cents: number | null;
                    vat_amount_cents: number | null;
                    vat_rate_basis_points: number | null;
                    gross_amount_cents: number | null;
                    booking_reservations: {
                        customer_full_name: string;
                        customer_email: string;
                        customer_phone: string | null;
                        portal_client_id: string | null;
                    } | null;
                    } | null;
                error: { message: string } | null;
            };
        if (paymentFactsResult.error) throw new Error(paymentFactsResult.error.message);
        const paymentFacts = paymentFactsResult.data;
        const bookingId = input.bookingId ?? paymentFacts?.reservation_id ?? null;
        const resolvedCustomer = input.customer ?? (paymentFacts?.booking_reservations
            ? {
                name: paymentFacts.booking_reservations.customer_full_name,
                email: paymentFacts.booking_reservations.customer_email,
                phone: paymentFacts.booking_reservations.customer_phone,
                portalClientId: paymentFacts.booking_reservations.portal_client_id,
            }
            : undefined);
        const canonicalCustomerId = await resolveCanonicalCustomerId({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            portalClientId: resolvedCustomer?.portalClientId,
            email: resolvedCustomer?.email,
            bookingId,
            paymentId: input.paymentId,
        });
        const upsertedCustomerId = (resolvedCustomer?.email || resolvedCustomer?.portalClientId)
            ? await upsertCustomerForSignal({
                supabase: input.supabase,
                workspaceId: input.workspaceId,
                displayName: displayName(resolvedCustomer, "Payment customer"),
                email: resolvedCustomer.email,
                phone: resolvedCustomer.phone,
                portalClientId: resolvedCustomer.portalClientId,
                sourceModule: "payments",
                lifecycleStatus: input.eventType === "captured" ? "customer" : "lead",
                metadata: { paymentId: input.paymentId, bookingId },
            })
            : null;
        const customerId = canonicalCustomerId ?? upsertedCustomerId;
        const netAmountCents = input.netAmountCents ?? paymentFacts?.net_amount_cents ?? null;
        const vatAmountCents = input.vatAmountCents ?? paymentFacts?.vat_amount_cents ?? null;
        const vatRateBasisPoints = input.vatRateBasisPoints ?? paymentFacts?.vat_rate_basis_points ?? null;
        const grossAmountCents = input.grossAmountCents ?? paymentFacts?.gross_amount_cents ?? input.amountCents ?? null;
        await recordTimelineEvent({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            customerId,
            eventType: `payment.${input.eventType}`,
            summary: input.eventType === "captured_after_terminal"
                ? "PayPal capture arrived after the booking payment became terminal"
                : `PayPal payment ${input.eventType}`,
            sourceModule: "payments",
            sourceTable: "booking_payments",
            sourceId: input.paymentId,
            idempotencyKey: `payment:${input.paymentId}:${input.eventType}`,
            payload: {
                amountCents: input.amountCents ?? grossAmountCents,
                netAmountCents,
                vatAmountCents,
                vatRateBasisPoints,
                grossAmountCents,
                currency: input.currency ?? null,
                bookingId,
            },
        });
        if (input.eventType === "captured_after_terminal") {
            await upsertWorkItem({
                supabase: input.supabase,
                workspaceId: input.workspaceId,
                customerId,
                title: "Reconcile late PayPal capture",
                description: "A PayPal capture arrived after the booking payment became terminal. Verify provider evidence and the customer/booking outcome.",
                kind: "payment_reconciliation",
                priority: "urgent",
                sourceModule: "payments",
                sourceEntityType: "booking_payment",
                sourceEntityId: input.paymentId,
                idempotencyKey: `work:payment-reconciliation:${input.paymentId}`,
                metadata: {
                    ...(input.payload ?? {}),
                    paymentId: input.paymentId,
                    bookingId,
                    providerEventId: input.providerEventId ?? null,
                },
            });
        }
        await recordBusinessIntegrationEvent({
            workspaceId: input.workspaceId,
            provider: "paypal",
            integrationKey: "booking-checkout",
            eventType: `payment.${input.eventType}`,
            providerEventId: input.providerEventId ?? input.paymentId,
            payload: input.payload,
        });
        await recordBusinessIntegrationHealthCheck({
            workspaceId: input.workspaceId,
            provider: "paypal",
            integrationKey: "booking-checkout",
            status: input.eventType === "failed" || input.eventType === "captured_after_terminal" ? "degraded" : "healthy",
            message: input.eventType === "captured_after_terminal"
                ? "PayPal capture requires reconciliation after a terminal booking payment"
                : `PayPal payment ${input.eventType}`,
            details: { paymentId: input.paymentId, bookingId },
        });
        if (input.eventType === "captured") {
            await upsertCommercialLink({
                supabase: input.supabase,
                workspaceId: input.workspaceId,
                customerId,
                linkType: "booking_payment",
                linkedRecordType: "booking_payment",
                linkedRecordId: input.paymentId,
                linkedRecordRef: bookingId ?? undefined,
                metadata: {
                    amountCents: input.amountCents ?? grossAmountCents,
                    netAmountCents,
                    vatAmountCents,
                    vatRateBasisPoints,
                    grossAmountCents,
                    currency: input.currency ?? null,
                },
            });
        }
    });
    await bestEffortWorkflow({
        workspaceId: input.workspaceId,
        sourceModule: "payments",
        recorderEventKey: `payment.${input.eventType}`,
        sourceEntityType: "booking_payment",
        sourceEntityId: input.paymentId,
        payload: {
            ...(input.payload ?? {}),
            paymentId: input.paymentId,
            bookingId: input.bookingId ?? null,
            amountCents: input.amountCents ?? null,
            netAmountCents: input.netAmountCents ?? null,
            vatAmountCents: input.vatAmountCents ?? null,
            vatRateBasisPoints: input.vatRateBasisPoints ?? null,
            grossAmountCents: input.grossAmountCents ?? input.amountCents ?? null,
            currency: input.currency ?? null,
            providerEventId: input.providerEventId ?? null,
        },
        idempotencyValues: { paymentId: input.paymentId, providerEventId: input.providerEventId ?? undefined },
    });
}

export async function recordLegalAgreementBusinessEvent(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    agreementId: string;
    eventType: "sent" | "viewed" | "signed" | "voided";
    customer?: CustomerSignal;
    title?: string | null;
    payload?: Record<string, unknown>;
}) {
    await bestEffort("legal", async () => {
        const customerId = input.customer?.email
            ? await upsertCustomerForSignal({
                supabase: input.supabase,
                workspaceId: input.workspaceId,
                displayName: displayName(input.customer, "Legal counterparty"),
                email: input.customer.email,
                sourceModule: "legal",
                lifecycleStatus: input.eventType === "signed" ? "customer" : "qualified",
                metadata: { agreementId: input.agreementId },
            })
            : null;
        await recordTimelineEvent({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            customerId,
            eventType: `legal.agreement_${input.eventType}`,
            summary: `Agreement ${input.eventType}: ${input.title ?? "Legal agreement"}`,
            sourceModule: "legal",
            sourceTable: "legal_documents",
            sourceId: input.agreementId,
            idempotencyKey: `legal:${input.agreementId}:${input.eventType}`,
            payload: input.payload,
        });
        if (input.eventType === "signed") {
            await upsertWorkItem({
                supabase: input.supabase,
                workspaceId: input.workspaceId,
                customerId,
                title: "Agreement signed follow-up",
                description: input.title ?? null,
                kind: "legal_follow_up",
                priority: "normal",
                sourceModule: "legal",
                sourceEntityType: "legal_document",
                sourceEntityId: input.agreementId,
                idempotencyKey: `work:legal-signed:${input.agreementId}`,
                metadata: input.payload,
            });
        }
    });
    await bestEffortWorkflow({
        workspaceId: input.workspaceId,
        sourceModule: "legal",
        recorderEventKey: `legal.agreement_${input.eventType}`,
        sourceEntityType: "legal_document",
        sourceEntityId: input.agreementId,
        payload: { ...(input.payload ?? {}), agreementId: input.agreementId, title: input.title ?? null },
        idempotencyValues: { agreementId: input.agreementId },
    });
}

export type LegalInvoiceBusinessEventType = "draft" | "sent" | "paid" | "overdue" | "voided" | "credited";

export function buildLegalInvoiceBusinessTimelinePayload(input: {
    eventType: LegalInvoiceBusinessEventType;
    invoiceId: string;
    invoiceNumber?: string | null;
    clientName?: string | null;
    relatedAgreementId?: string | null;
    totalCents?: number | null;
    currency?: string | null;
    dueDate?: string | null;
    payload?: Record<string, unknown>;
}) {
    const label = input.invoiceNumber ?? `Invoice ${input.invoiceId}`;
    const statusLabel = input.eventType === "voided" ? "voided" : input.eventType;

    return {
        eventType: `legal.invoice_${input.eventType}`,
        summary: `Invoice ${statusLabel}: ${label}`,
        sourceModule: "legal",
        sourceTable: "legal_invoices",
        sourceId: input.invoiceId,
        idempotencyKey: `legal-invoice:${input.invoiceId}:${input.eventType}`,
        payload: {
            ...(input.payload ?? {}),
            invoiceId: input.invoiceId,
            invoiceNumber: input.invoiceNumber ?? null,
            clientName: input.clientName ?? null,
            relatedAgreementId: input.relatedAgreementId ?? null,
            totalCents: input.totalCents ?? null,
            currency: input.currency ?? null,
            dueDate: input.dueDate ?? null,
        },
    };
}

export async function recordLegalInvoiceBusinessEvent(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    invoiceId: string;
    eventType: LegalInvoiceBusinessEventType;
    customer?: CustomerSignal;
    customerId?: string | null;
    invoiceNumber?: string | null;
    clientName?: string | null;
    relatedAgreementId?: string | null;
    totalCents?: number | null;
    currency?: string | null;
    dueDate?: string | null;
    payload?: Record<string, unknown>;
}) {
    await bestEffort("legal-invoice", async () => {
        const customerId = input.customerId ?? (input.customer?.email || input.customer?.portalClientId
            ? await upsertCustomerForSignal({
                supabase: input.supabase,
                workspaceId: input.workspaceId,
                displayName: input.clientName ?? displayName(input.customer, "Invoice customer"),
                email: input.customer.email,
                phone: input.customer.phone,
                portalClientId: input.customer.portalClientId,
                sourceModule: "legal",
                lifecycleStatus: input.eventType === "paid" ? "customer" : "qualified",
                metadata: { invoiceId: input.invoiceId, relatedAgreementId: input.relatedAgreementId ?? null },
            })
            : null);

        const timeline = buildLegalInvoiceBusinessTimelinePayload({
            eventType: input.eventType,
            invoiceId: input.invoiceId,
            invoiceNumber: input.invoiceNumber,
            clientName: input.clientName,
            relatedAgreementId: input.relatedAgreementId,
            totalCents: input.totalCents,
            currency: input.currency,
            dueDate: input.dueDate,
            payload: input.payload,
        });

        await recordTimelineEvent({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            customerId,
            ...timeline,
        });

        await linkAgreementToInvoice({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            customerId,
            invoiceId: input.invoiceId,
            agreementId: input.relatedAgreementId,
            invoiceNumber: input.invoiceNumber,
            metadata: {
                status: input.eventType,
                clientName: input.clientName ?? null,
                dueDate: input.dueDate ?? null,
            },
        });
    });

    await bestEffortWorkflow({
        workspaceId: input.workspaceId,
        sourceModule: "legal",
        recorderEventKey: `legal.invoice_${input.eventType}`,
        sourceEntityType: "legal_invoice",
        sourceEntityId: input.invoiceId,
        payload: {
            ...(input.payload ?? {}),
            invoiceId: input.invoiceId,
            invoiceNumber: input.invoiceNumber ?? null,
            clientName: input.clientName ?? null,
            relatedAgreementId: input.relatedAgreementId ?? null,
            totalCents: input.totalCents ?? null,
            currency: input.currency ?? null,
            dueDate: input.dueDate ?? null,
        },
        idempotencyValues: { invoiceId: input.invoiceId },
    });
}

export async function recordGscBusinessEvent(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    opportunityId: string;
    title: string;
    url?: string | null;
    payload?: Record<string, unknown>;
}) {
    await bestEffort("gsc", async () => {
        await upsertWorkItem({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            title: input.title,
            description: input.url ?? null,
            kind: "content_refresh",
            priority: "high",
            sourceModule: "gsc",
            sourceEntityType: "gsc_opportunity",
            sourceEntityId: input.opportunityId,
            idempotencyKey: `work:gsc-content-refresh:${input.opportunityId}`,
            metadata: input.payload,
        });
        await recordBusinessIntegrationEvent({
            workspaceId: input.workspaceId,
            provider: "google-search-console",
            integrationKey: "search-performance",
            eventType: "gsc.opportunity_detected",
            providerEventId: input.opportunityId,
            payload: input.payload,
        });
    });
    await bestEffortWorkflow({
        workspaceId: input.workspaceId,
        sourceModule: "gsc",
        recorderEventKey: "gsc.opportunity_detected",
        sourceEntityType: "gsc_opportunity",
        sourceEntityId: input.opportunityId,
        payload: { ...(input.payload ?? {}), opportunityId: input.opportunityId, title: input.title, url: input.url ?? null },
        idempotencyValues: { opportunityId: input.opportunityId },
    });
}

export async function recordSeoBusinessEvent(input: {
    workspaceId: string;
    eventType: "automation_applied" | "automation_rolled_back";
    recommendationId: string;
    payload?: Record<string, unknown>;
}) {
    await bestEffort("seo", async () => {
        await recordBusinessIntegrationEvent({
            workspaceId: input.workspaceId,
            provider: "seo",
            integrationKey: "internal-links-worker",
            eventType: `seo.${input.eventType}`,
            providerEventId: `${input.eventType}:${input.recommendationId}`,
            payload: input.payload,
        });
    });
}

export async function recordSourceIntelligenceBusinessEvent(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    eventType: "ingestion_failed" | "source_stale";
    sourceId: string;
    title?: string | null;
    message?: string | null;
    payload?: Record<string, unknown>;
}) {
    await bestEffort("source-intelligence", async () => {
        await upsertWorkItem({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            title: input.eventType === "source_stale" ? `Refresh stale source: ${input.title ?? input.sourceId}` : `Source ingestion failed: ${input.title ?? input.sourceId}`,
            description: input.message ?? null,
            kind: input.eventType,
            priority: input.eventType === "ingestion_failed" ? "high" : "normal",
            sourceModule: "source-intelligence",
            sourceEntityType: "source_registry",
            sourceEntityId: input.sourceId,
            idempotencyKey: `work:source:${input.eventType}:${input.sourceId}`,
            metadata: input.payload,
        });
        await recordBusinessIntegrationEvent({
            workspaceId: input.workspaceId,
            provider: "source-intelligence",
            integrationKey: "worker",
            eventType: `source.${input.eventType}`,
            providerEventId: `${input.eventType}:${input.sourceId}`,
            payload: input.payload,
        });
    });
    await bestEffortWorkflow({
        workspaceId: input.workspaceId,
        sourceModule: "source-intelligence",
        recorderEventKey: `source.${input.eventType}`,
        sourceEntityType: "source_registry",
        sourceEntityId: input.sourceId,
        payload: { ...(input.payload ?? {}), sourceId: input.sourceId, title: input.title ?? null, message: input.message ?? null },
        idempotencyValues: { sourceId: input.sourceId },
    });
}
