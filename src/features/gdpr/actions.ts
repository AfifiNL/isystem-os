"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { hashEmailForAnalytics } from "@/features/analytics/privacy";
import type {
    GdprRequestStatus,
    GdprRequestType,
    SubProcessor,
    SubjectDataExport,
    WorkspaceGdprRequest,
    WorkspaceGdprSettings,
} from "./types";

async function requireWorkspace(): Promise<{ workspaceId: string; userId: string } | { error: string }> {
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) return { error: "No active workspace." };
    if (!ctx.userId) return { error: "Not authenticated." };
    return { workspaceId: ctx.activeWorkspace.id, userId: ctx.userId };
}

function defaultSettings(workspaceId: string): WorkspaceGdprSettings {
    return {
        workspace_id: workspaceId,
        dpo_name: null,
        dpo_email: null,
        privacy_policy_url: null,
        terms_url: null,
        processing_legal_basis: "legitimate_interest",
        analytics_retention_days: 365,
        logs_retention_days: 90,
        marketing_retention_days: 730,
        sub_processors: [],
        data_regions: ["EU"],
        consent_required: true,
        cookie_consent_mode: "banner",
        notes: null,
        updated_at: new Date(0).toISOString(),
        created_at: new Date(0).toISOString(),
    };
}

export async function getGdprSettings(): Promise<{
    data: WorkspaceGdprSettings | null;
    error: string | null;
}> {
    const ctx = await requireWorkspace();
    if ("error" in ctx) return { data: null, error: ctx.error };
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_gdpr_settings")
        .select("*")
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
    if (error && error.code !== "PGRST116") {
        return { data: null, error: error.message };
    }
    const settings = (data as WorkspaceGdprSettings | null) ?? defaultSettings(ctx.workspaceId);
    return { data: settings, error: null };
}

export interface UpdateGdprSettingsInput {
    dpo_name?: string | null;
    dpo_email?: string | null;
    privacy_policy_url?: string | null;
    terms_url?: string | null;
    processing_legal_basis?: string;
    analytics_retention_days?: number;
    logs_retention_days?: number;
    marketing_retention_days?: number;
    sub_processors?: SubProcessor[];
    data_regions?: string[];
    consent_required?: boolean;
    cookie_consent_mode?: string;
    notes?: string | null;
}

function sanitizeRetention(days: unknown, fallback: number, { min = 1, max = 3650 } = {}): number {
    if (typeof days !== "number" || !Number.isFinite(days)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(days)));
}

function sanitizeProcessors(value: unknown): SubProcessor[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((v) => v && typeof v === "object")
        .map((v) => {
            const obj = v as Record<string, unknown>;
            return {
                name: String(obj.name ?? "").slice(0, 120),
                purpose: String(obj.purpose ?? "").slice(0, 200),
                location: obj.location ? String(obj.location).slice(0, 80) : undefined,
                url: obj.url ? String(obj.url).slice(0, 500) : undefined,
                dpa_url: obj.dpa_url ? String(obj.dpa_url).slice(0, 500) : undefined,
            };
        })
        .filter((p) => p.name.length > 0);
}

const ALLOWED_LEGAL_BASIS = new Set([
    "consent",
    "contract",
    "legal_obligation",
    "vital_interests",
    "public_task",
    "legitimate_interest",
]);
const ALLOWED_COOKIE_MODES = new Set(["banner", "essential_only", "preferences_panel", "none"]);
const ALLOWED_REGIONS = new Set(["EU", "UK", "US", "APAC", "Global"]);

export async function saveGdprSettings(input: UpdateGdprSettingsInput): Promise<{
    data: WorkspaceGdprSettings | null;
    error: string | null;
}> {
    const ctx = await requireWorkspace();
    if ("error" in ctx) return { data: null, error: ctx.error };
    const supabase = await createClient();

    const payload: Record<string, unknown> = {
        workspace_id: ctx.workspaceId,
        updated_at: new Date().toISOString(),
    };

    if (input.dpo_name !== undefined) payload.dpo_name = input.dpo_name ? String(input.dpo_name).slice(0, 120) : null;
    if (input.dpo_email !== undefined) payload.dpo_email = input.dpo_email ? String(input.dpo_email).slice(0, 200) : null;
    if (input.privacy_policy_url !== undefined)
        payload.privacy_policy_url = input.privacy_policy_url ? String(input.privacy_policy_url).slice(0, 500) : null;
    if (input.terms_url !== undefined) payload.terms_url = input.terms_url ? String(input.terms_url).slice(0, 500) : null;
    if (input.processing_legal_basis !== undefined) {
        payload.processing_legal_basis = ALLOWED_LEGAL_BASIS.has(input.processing_legal_basis)
            ? input.processing_legal_basis
            : "legitimate_interest";
    }
    if (input.analytics_retention_days !== undefined)
        payload.analytics_retention_days = sanitizeRetention(input.analytics_retention_days, 365);
    if (input.logs_retention_days !== undefined)
        payload.logs_retention_days = sanitizeRetention(input.logs_retention_days, 90);
    if (input.marketing_retention_days !== undefined)
        payload.marketing_retention_days = sanitizeRetention(input.marketing_retention_days, 730);
    if (input.sub_processors !== undefined) payload.sub_processors = sanitizeProcessors(input.sub_processors);
    if (input.data_regions !== undefined) {
        const regions = Array.isArray(input.data_regions)
            ? input.data_regions.filter((r) => ALLOWED_REGIONS.has(r))
            : ["EU"];
        payload.data_regions = regions.length ? regions : ["EU"];
    }
    if (input.consent_required !== undefined) payload.consent_required = Boolean(input.consent_required);
    if (input.cookie_consent_mode !== undefined) {
        payload.cookie_consent_mode = ALLOWED_COOKIE_MODES.has(input.cookie_consent_mode)
            ? input.cookie_consent_mode
            : "banner";
    }
    if (input.notes !== undefined) payload.notes = input.notes ? String(input.notes).slice(0, 4000) : null;

    const { data, error } = await supabase
        .from("workspace_gdpr_settings")
        .upsert(payload, { onConflict: "workspace_id" })
        .select("*")
        .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/settings");
    return { data: data as WorkspaceGdprSettings, error: null };
}

// ────────────────────────────────────────────────────────────────────────────────
// Data subject requests
// ────────────────────────────────────────────────────────────────────────────────

export interface GdprRequestsQuery {
    statuses?: GdprRequestStatus[];
    types?: GdprRequestType[];
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface GdprRequestsListResult {
    data: WorkspaceGdprRequest[];
    total: number;
    page: number;
    pageSize: number;
    statusCounts: Record<GdprRequestStatus, number>;
    error: string | null;
}

export async function listGdprRequests(
    query: GdprRequestsQuery = {},
): Promise<GdprRequestsListResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 20));
    const emptyCounts: Record<GdprRequestStatus, number> = {
        open: 0,
        in_progress: 0,
        completed: 0,
        rejected: 0,
    };

    const ctx = await requireWorkspace();
    if ("error" in ctx) {
        return { data: [], total: 0, page, pageSize, statusCounts: emptyCounts, error: ctx.error };
    }
    const supabase = await createClient();

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let builder = (supabase.from("workspace_gdpr_requests") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("*", { count: "exact" })
        .eq("workspace_id", ctx.workspaceId);

    if (query.statuses && query.statuses.length > 0) {
        builder = builder.in("status", query.statuses);
    }
    if (query.types && query.types.length > 0) {
        builder = builder.in("request_type", query.types);
    }
    if (query.search && query.search.trim()) {
        const term = query.search.trim().replace(/[%_]/g, "\\$&");
        builder = builder.or(`subject_email.ilike.%${term}%,subject_name.ilike.%${term}%,notes.ilike.%${term}%`);
    }

    const countStatus = async (status: GdprRequestStatus) => {
        const res = await (supabase.from("workspace_gdpr_requests") as unknown as {
            select: (c: string, opts: { count: "exact"; head: true }) => {
                eq: (c: string, v: string) => {
                    eq: (c: string, v: string) => Promise<{ count: number | null }>;
                };
            };
        })
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", ctx.workspaceId)
            .eq("status", status);
        return { status, count: res.count ?? 0 };
    };

    const [listRes, ...counts] = await Promise.all([
        builder.order("requested_at", { ascending: false }).range(from, to),
        ...(["open", "in_progress", "completed", "rejected"] as GdprRequestStatus[]).map(countStatus),
    ]);

    if (listRes.error) {
        return {
            data: [],
            total: 0,
            page,
            pageSize,
            statusCounts: emptyCounts,
            error: listRes.error.message,
        };
    }

    const statusCounts = { ...emptyCounts };
    for (const c of counts) {
        statusCounts[c.status] = c.count;
    }

    return {
        data: (listRes.data ?? []) as WorkspaceGdprRequest[],
        total: listRes.count ?? 0,
        page,
        pageSize,
        statusCounts,
        error: null,
    };
}

export interface CreateGdprRequestInput {
    subjectEmail: string;
    subjectName?: string | null;
    requestType: GdprRequestType;
    notes?: string | null;
}

const ALLOWED_REQUEST_TYPES: GdprRequestType[] = [
    "export",
    "deletion",
    "rectification",
    "access",
    "portability",
    "restriction",
];

export async function createGdprRequest(
    input: CreateGdprRequestInput,
): Promise<{ data: WorkspaceGdprRequest | null; error: string | null }> {
    const email = input.subjectEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { data: null, error: "Valid subject email is required." };
    }
    if (!ALLOWED_REQUEST_TYPES.includes(input.requestType)) {
        return { data: null, error: "Invalid request type." };
    }

    const ctx = await requireWorkspace();
    if ("error" in ctx) return { data: null, error: ctx.error };
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("workspace_gdpr_requests")
        .insert({
            workspace_id: ctx.workspaceId,
            request_type: input.requestType,
            subject_email: email,
            subject_name: input.subjectName ? String(input.subjectName).slice(0, 200) : null,
            notes: input.notes ? String(input.notes).slice(0, 4000) : null,
        })
        .select("*")
        .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/settings");
    return { data: data as WorkspaceGdprRequest, error: null };
}

export async function updateGdprRequestStatus(
    id: string,
    nextStatus: GdprRequestStatus,
    notes?: string | null,
): Promise<{ error: string | null }> {
    const ctx = await requireWorkspace();
    if ("error" in ctx) return { error: ctx.error };
    if (!["open", "in_progress", "completed", "rejected"].includes(nextStatus)) {
        return { error: "Invalid status." };
    }
    const supabase = await createClient();
    const patch: Record<string, unknown> = {
        status: nextStatus,
        updated_at: new Date().toISOString(),
    };
    if (nextStatus === "completed" || nextStatus === "rejected") {
        patch.completed_at = new Date().toISOString();
        patch.completed_by_profile_id = ctx.userId;
    } else {
        patch.completed_at = null;
        patch.completed_by_profile_id = null;
    }
    if (notes !== undefined) patch.notes = notes ? String(notes).slice(0, 4000) : null;

    const { error } = await supabase
        .from("workspace_gdpr_requests")
        .update(patch)
        .eq("id", id)
        .eq("workspace_id", ctx.workspaceId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings");
    return { error: null };
}

export async function deleteGdprRequest(id: string): Promise<{ error: string | null }> {
    const ctx = await requireWorkspace();
    if ("error" in ctx) return { error: ctx.error };
    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_gdpr_requests")
        .delete()
        .eq("id", id)
        .eq("workspace_id", ctx.workspaceId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings");
    return { error: null };
}

// ────────────────────────────────────────────────────────────────────────────────
// Data subject export + erasure
// ────────────────────────────────────────────────────────────────────────────────

export async function exportSubjectData(
    subjectEmail: string,
): Promise<{ data: SubjectDataExport | null; error: string | null }> {
    const email = subjectEmail.trim().toLowerCase();
    if (!email) return { data: null, error: "Subject email is required." };
    const ctx = await requireWorkspace();
    if ("error" in ctx) return { data: null, error: ctx.error };
    const supabase = await createClient();
    const emailHash = hashEmailForAnalytics(email);
    const analyticsSubjectClause = emailHash
        ? `metadata->>emailHash.eq.${emailHash},metadata->>email_hash.eq.${emailHash},metadata->>email.eq.${email},event_name.eq.${email}`
        : `metadata->>email.eq.${email},event_name.eq.${email}`;

    const [newsletterRes, outreachRes, bookingRes, portalRes, analyticsCountRes] = await Promise.all([
        supabase
            .from("newsletter_contacts")
            .select("*")
            .eq("workspace_id", ctx.workspaceId)
            .ilike("email", email)
            .limit(1000),
        supabase
            .from("outreach_contacts" as never)
            .select("*" as never)
            .eq("workspace_id" as never, ctx.workspaceId as never)
            .ilike("email" as never, email as never)
            .limit(1000),
        supabase
            .from("booking_reservations")
            .select("id,status,customer_email,customer_name,scheduled_start,notes")
            .eq("workspace_id", ctx.workspaceId)
            .ilike("customer_email", email)
            .limit(1000),
        supabase
            .from("client_portal_users")
            .select("id,company_name,created_at")
            .eq("workspace_id", ctx.workspaceId)
            .limit(1000),
        (supabase.from("analytics_events") as unknown as {
            select: (c: string, opts: { count: "exact"; head: true }) => {
                eq: (c: string, v: string) => {
                    or: (clause: string) => Promise<{ count: number | null }>;
                };
            };
        })
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", ctx.workspaceId)
            .or(analyticsSubjectClause),
    ]);

    return {
        data: {
            subjectEmail: email,
            newsletterContacts: (newsletterRes.data ?? []) as unknown[],
            outreachContacts: (outreachRes.data ?? []) as unknown[],
            bookingReservations: (bookingRes.data ?? []) as unknown[],
            portalClients: (portalRes.data ?? []) as unknown[],
            analyticsEventsCount: (analyticsCountRes as { count?: number | null }).count ?? 0,
            generatedAt: new Date().toISOString(),
        },
        error: null,
    };
}

export async function deleteSubjectData(subjectEmail: string): Promise<{
    error: string | null;
    deleted: { newsletterContacts: number; outreachContacts: number; bookingReservations: number };
}> {
    const email = subjectEmail.trim().toLowerCase();
    if (!email) return { error: "Subject email is required.", deleted: { newsletterContacts: 0, outreachContacts: 0, bookingReservations: 0 } };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return {
            error: "Invalid subject email.",
            deleted: { newsletterContacts: 0, outreachContacts: 0, bookingReservations: 0 },
        };
    }
    const ctx = await requireWorkspace();
    if ("error" in ctx) return { error: ctx.error, deleted: { newsletterContacts: 0, outreachContacts: 0, bookingReservations: 0 } };
    const supabase = await createClient();

    const deleteFrom = async (
        table: string,
        column: string,
    ): Promise<number> => {
        const { count } = await (supabase as unknown as {
            from: (t: string) => {
                delete: (opts: { count: "exact" }) => {
                    eq: (c: string, v: string) => {
                        ilike: (c: string, v: string) => Promise<{ count: number | null }>;
                    };
                };
            };
        })
            .from(table)
            .delete({ count: "exact" })
            .eq("workspace_id", ctx.workspaceId)
            .ilike(column, email);
        return count ?? 0;
    };

    const [newsletterDeleted, outreachDeleted, bookingDeleted] = await Promise.all([
        deleteFrom("newsletter_contacts", "email"),
        deleteFrom("outreach_contacts", "email"),
        deleteFrom("booking_reservations", "customer_email"),
    ]);

    revalidatePath("/dashboard/settings");

    return {
        error: null,
        deleted: {
            newsletterContacts: newsletterDeleted,
            outreachContacts: outreachDeleted,
            bookingReservations: bookingDeleted,
        },
    };
}
