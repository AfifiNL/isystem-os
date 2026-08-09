import type { SupabaseClient } from "@supabase/supabase-js";

export type CustomerIdentityLookupKind = "portal_client" | "email" | "booking" | "legal_agreement" | "payment";

export type CustomerIdentityLookup = {
    kind: CustomerIdentityLookupKind;
    value: string;
};

type SupabaseLike = SupabaseClient;

type CustomerIdentityRow = {
    id: string;
};

type EmailSourceRow = {
    customer_email?: string | null;
    party_email?: string | null;
};

export function normalizeCustomerEmail(email?: string | null) {
    const normalized = email?.trim().toLowerCase() ?? "";
    return normalized || null;
}

export function buildCustomerIdentityLookupPlan(input: {
    portalClientId?: string | null;
    email?: string | null;
    bookingId?: string | null;
    legalAgreementId?: string | null;
    paymentId?: string | null;
}): CustomerIdentityLookup[] {
    const plan: CustomerIdentityLookup[] = [];
    const normalizedEmail = normalizeCustomerEmail(input.email);
    const add = (kind: CustomerIdentityLookupKind, value?: string | null) => {
        const trimmed = value?.trim();
        if (trimmed) plan.push({ kind, value: trimmed });
    };

    add("portal_client", input.portalClientId);
    if (normalizedEmail) add("email", normalizedEmail);
    add("booking", input.bookingId);
    add("legal_agreement", input.legalAgreementId);
    add("payment", input.paymentId);

    return plan;
}

async function findCustomerByPortalClient(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    portalClientId: string;
}) {
    const { data } = await input.supabase
        .from("workspace_customers" as never)
        .select("id" as never)
        .eq("workspace_id" as never, input.workspaceId as never)
        .eq("portal_client_id" as never, input.portalClientId as never)
        .is("deleted_at" as never, null as never)
        .maybeSingle() as unknown as { data: CustomerIdentityRow | null; error: unknown };
    return data?.id ?? null;
}

async function findCustomerByEmail(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    email: string;
}) {
    const normalizedEmail = normalizeCustomerEmail(input.email);
    if (!normalizedEmail) return null;

    const { data } = await input.supabase
        .from("workspace_customers" as never)
        .select("id" as never)
        .eq("workspace_id" as never, input.workspaceId as never)
        .eq("primary_email" as never, normalizedEmail as never)
        .is("deleted_at" as never, null as never)
        .maybeSingle() as unknown as { data: CustomerIdentityRow | null; error: unknown };
    return data?.id ?? null;
}

async function findEmailByBooking(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    bookingId: string;
}) {
    const { data } = await input.supabase
        .from("booking_reservations" as never)
        .select("customer_email" as never)
        .eq("workspace_id" as never, input.workspaceId as never)
        .eq("id" as never, input.bookingId as never)
        .maybeSingle() as unknown as { data: EmailSourceRow | null; error: unknown };
    return normalizeCustomerEmail(data?.customer_email ?? null);
}

async function findEmailByLegalAgreement(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    legalAgreementId: string;
}) {
    const { data } = await input.supabase
        .from("legal_agreements" as never)
        .select("party_email" as never)
        .eq("workspace_id" as never, input.workspaceId as never)
        .eq("id" as never, input.legalAgreementId as never)
        .maybeSingle() as unknown as { data: EmailSourceRow | null; error: unknown };
    return normalizeCustomerEmail(data?.party_email ?? null);
}

async function findBookingIdByPayment(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    paymentId: string;
}) {
    const { data } = await input.supabase
        .from("booking_payments" as never)
        .select("reservation_id" as never)
        .eq("workspace_id" as never, input.workspaceId as never)
        .eq("id" as never, input.paymentId as never)
        .maybeSingle() as unknown as { data: { reservation_id: string | null } | null; error: unknown };
    return data?.reservation_id ?? null;
}

export async function resolveCanonicalCustomerId(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    portalClientId?: string | null;
    email?: string | null;
    bookingId?: string | null;
    legalAgreementId?: string | null;
    paymentId?: string | null;
}): Promise<string | null> {
    try {
        for (const lookup of buildCustomerIdentityLookupPlan(input)) {
            if (lookup.kind === "portal_client") {
                const customerId = await findCustomerByPortalClient({
                    supabase: input.supabase,
                    workspaceId: input.workspaceId,
                    portalClientId: lookup.value,
                });
                if (customerId) return customerId;
            }

            if (lookup.kind === "email") {
                const customerId = await findCustomerByEmail({
                    supabase: input.supabase,
                    workspaceId: input.workspaceId,
                    email: lookup.value,
                });
                if (customerId) return customerId;
            }

            if (lookup.kind === "booking") {
                const email = await findEmailByBooking({
                    supabase: input.supabase,
                    workspaceId: input.workspaceId,
                    bookingId: lookup.value,
                });
                if (!email) continue;
                const customerId = await findCustomerByEmail({
                    supabase: input.supabase,
                    workspaceId: input.workspaceId,
                    email,
                });
                if (customerId) return customerId;
            }

            if (lookup.kind === "legal_agreement") {
                const email = await findEmailByLegalAgreement({
                    supabase: input.supabase,
                    workspaceId: input.workspaceId,
                    legalAgreementId: lookup.value,
                });
                if (!email) continue;
                const customerId = await findCustomerByEmail({
                    supabase: input.supabase,
                    workspaceId: input.workspaceId,
                    email,
                });
                if (customerId) return customerId;
            }

            if (lookup.kind === "payment") {
                const bookingId = await findBookingIdByPayment({
                    supabase: input.supabase,
                    workspaceId: input.workspaceId,
                    paymentId: lookup.value,
                });
                if (!bookingId) continue;
                const email = await findEmailByBooking({
                    supabase: input.supabase,
                    workspaceId: input.workspaceId,
                    bookingId,
                });
                if (!email) continue;
                const customerId = await findCustomerByEmail({
                    supabase: input.supabase,
                    workspaceId: input.workspaceId,
                    email,
                });
                if (customerId) return customerId;
            }
        }
    } catch (error) {
        console.warn("[business-spine] customer identity resolution failed", error);
    }

    return null;
}
