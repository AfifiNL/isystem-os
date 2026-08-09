"use server";

import { revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { assertWorkspaceAdminOrManager } from "@/shared/lib/workspace/context";
import {
    POPUP_TEMPLATE_DEFAULTS,
    popupConfigSchema,
    popupMatchesAudience,
    type PopupConfigInput,
    type PopupTemplateKind,
    type PopupTrigger,
    type ResolvedPopup,
} from "./schema";
import type { Locale } from "@/features/templates/types";

// Cache tag used to invalidate the public popup resolver after admin edits.
// Per-workspace so editing one tenant's popups doesn't blow another's cache.
function popupsCacheTag(workspaceId: string): string {
    return `popups:${workspaceId}`;
}

export interface PopupRow {
    id: string;
    workspace_id: string;
    name: string;
    template_kind: PopupTemplateKind;
    trigger_type: "exit_intent" | "timed";
    trigger_config: Record<string, unknown>;
    content: PopupConfigInput["content"];
    audience: PopupConfigInput["audience"] | null;
    starts_at: string | null;
    ends_at: string | null;
    priority: number;
    dismissal_ttl_seconds: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

function toPopupTrigger(row: Pick<PopupRow, "trigger_type" | "trigger_config">): PopupTrigger {
    if (row.trigger_type === "timed") {
        const delay = Number((row.trigger_config as { delay_ms?: unknown }).delay_ms);
        return {
            type: "timed",
            config: { delay_ms: Number.isFinite(delay) && delay >= 500 ? Math.floor(delay) : 8_000 },
        };
    }
    return { type: "exit_intent", config: {} };
}

function rowToConfigInput(row: PopupRow): PopupConfigInput {
    return {
        name: row.name,
        template_kind: row.template_kind,
        trigger: toPopupTrigger(row),
        content: row.content,
        audience: row.audience ?? {},
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        priority: row.priority,
        dismissal_ttl_seconds: row.dismissal_ttl_seconds,
        is_active: row.is_active,
    };
}

// ─── Admin actions ─────────────────────────────────────────────────────────

export async function listPopupsForCurrentWorkspace(): Promise<{
    data: PopupRow[];
    error: string | null;
}> {
    try {
        const context = await assertWorkspaceAdminOrManager();
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("workspace_popups")
            .select("*")
            .eq("workspace_id", context.activeWorkspace.id)
            .order("priority", { ascending: false })
            .order("updated_at", { ascending: false });
        if (error) return { data: [], error: error.message };
        return { data: (data ?? []) as PopupRow[], error: null };
    } catch (err) {
        return { data: [], error: err instanceof Error ? err.message : "Failed to list popups." };
    }
}

export async function createPopupFromTemplate(
    templateKind: PopupTemplateKind,
): Promise<{ data: PopupRow | null; error: string | null }> {
    try {
        const context = await assertWorkspaceAdminOrManager();
        const defaults = POPUP_TEMPLATE_DEFAULTS[templateKind];
        const input: PopupConfigInput = {
            name: defaults.name,
            template_kind: templateKind,
            trigger: defaults.trigger,
            content: defaults.content,
            audience: {},
            starts_at: null,
            ends_at: null,
            priority: 0,
            dismissal_ttl_seconds: 7 * 24 * 3600,
            is_active: false,
        };
        // Validate before insert. Should always pass for the seed defaults
        // but keeps a single code path between create-from-template and
        // edit-existing.
        const parsed = popupConfigSchema.parse(input);
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("workspace_popups")
            .insert({
                workspace_id: context.activeWorkspace.id,
                name: parsed.name,
                template_kind: parsed.template_kind,
                trigger_type: parsed.trigger.type,
                trigger_config: parsed.trigger.config,
                content: parsed.content,
                audience: parsed.audience,
                starts_at: parsed.starts_at,
                ends_at: parsed.ends_at,
                priority: parsed.priority,
                dismissal_ttl_seconds: parsed.dismissal_ttl_seconds,
                is_active: parsed.is_active,
                created_by_profile_id: context.userId,
            })
            .select("*")
            .single();
        if (error) return { data: null, error: error.message };
        revalidateTag(popupsCacheTag(context.activeWorkspace.id));
        return { data: data as PopupRow, error: null };
    } catch (err) {
        return { data: null, error: err instanceof Error ? err.message : "Failed to create popup." };
    }
}

export async function updatePopup(
    id: string,
    input: PopupConfigInput,
): Promise<{ data: PopupRow | null; error: string | null }> {
    try {
        const context = await assertWorkspaceAdminOrManager();
        const parsed = popupConfigSchema.parse(input);
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("workspace_popups")
            .update({
                name: parsed.name,
                template_kind: parsed.template_kind,
                trigger_type: parsed.trigger.type,
                trigger_config: parsed.trigger.config,
                content: parsed.content,
                audience: parsed.audience,
                starts_at: parsed.starts_at,
                ends_at: parsed.ends_at,
                priority: parsed.priority,
                dismissal_ttl_seconds: parsed.dismissal_ttl_seconds,
                is_active: parsed.is_active,
            })
            .eq("id", id)
            .eq("workspace_id", context.activeWorkspace.id)
            .select("*")
            .single();
        if (error) return { data: null, error: error.message };
        revalidateTag(popupsCacheTag(context.activeWorkspace.id));
        return { data: data as PopupRow, error: null };
    } catch (err) {
        return { data: null, error: err instanceof Error ? err.message : "Failed to update popup." };
    }
}

export async function deletePopup(id: string): Promise<{ error: string | null }> {
    try {
        const context = await assertWorkspaceAdminOrManager();
        const supabase = await createClient();
        const { error } = await supabase
            .from("workspace_popups")
            .delete()
            .eq("id", id)
            .eq("workspace_id", context.activeWorkspace.id);
        if (error) return { error: error.message };
        revalidateTag(popupsCacheTag(context.activeWorkspace.id));
        return { error: null };
    } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to delete popup." };
    }
}

export async function togglePopupActive(
    id: string,
    isActive: boolean,
): Promise<{ error: string | null }> {
    try {
        const context = await assertWorkspaceAdminOrManager();
        const supabase = await createClient();
        const { error } = await supabase
            .from("workspace_popups")
            .update({ is_active: isActive })
            .eq("id", id)
            .eq("workspace_id", context.activeWorkspace.id);
        if (error) return { error: error.message };
        revalidateTag(popupsCacheTag(context.activeWorkspace.id));
        return { error: null };
    } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to toggle popup." };
    }
}

export async function getPopupById(id: string): Promise<{ data: PopupConfigInput | null; error: string | null }> {
    try {
        const context = await assertWorkspaceAdminOrManager();
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("workspace_popups")
            .select("*")
            .eq("id", id)
            .eq("workspace_id", context.activeWorkspace.id)
            .maybeSingle();
        if (error) return { data: null, error: error.message };
        if (!data) return { data: null, error: "Popup not found." };
        return { data: rowToConfigInput(data as PopupRow), error: null };
    } catch (err) {
        return { data: null, error: err instanceof Error ? err.message : "Failed to load popup." };
    }
}

// ─── Public resolver ──────────────────────────────────────────────────────
// Anonymous (anon-key) read of active popups for a given workspace. Wrapped
// in unstable_cache so repeated SSR within the 60s window doesn't re-hit
// the DB; admin writes invalidate via revalidateTag(popupsCacheTag(...)).
// We deliberately use the service-role client here because the (public)
// layout runs without an auth session — the RLS policy already restricts
// SELECT to is_active=true rows so this is safe.

const fetchActivePopupRows = unstable_cache(
    async (workspaceId: string): Promise<PopupRow[]> => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        if (!supabaseUrl || !serviceRoleKey) return [];
        const client = createServiceClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const nowIso = new Date().toISOString();
        // Schedule window: starts_at <= now AND (ends_at IS NULL OR ends_at > now).
        // We do the schedule filter in SQL to keep the cached payload tight,
        // and the audience filter in JS (cheaper than a JSONB query and the
        // active-popup count per workspace is tiny).
        const { data, error } = await client
            .from("workspace_popups")
            .select("*")
            .eq("workspace_id", workspaceId)
            .eq("is_active", true)
            .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
            .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
            .order("priority", { ascending: false })
            .order("updated_at", { ascending: false });
        if (error) {
            console.warn("[popups] resolver fetch failed:", error.message);
            return [];
        }
        return (data ?? []) as PopupRow[];
    },
    ["popups:active-rows"],
    {
        revalidate: 60,
        tags: ["popups:any"],
    },
);

export interface ResolveActivePopupsArgs {
    workspaceId: string | null | undefined;
    locale: Locale;
    localeStrippedPath: string;
}

// Returns AT MOST ONE popup. Multiple popups can match the same request
// (e.g. timed newsletter + exit-intent booking) — we sort by priority DESC
// then most-recently-updated and pick the first. Stacked dialogs would be a
// terrible UX and there's no real product use case for them.
export async function resolveActivePopupForRequest(
    args: ResolveActivePopupsArgs,
): Promise<ResolvedPopup | null> {
    if (!args.workspaceId) return null;
    const rows = await fetchActivePopupRows(args.workspaceId);
    const matched = rows.find((row) =>
        popupMatchesAudience(row.audience ?? {}, {
            locale: args.locale,
            localeStrippedPath: args.localeStrippedPath,
        }),
    );
    if (!matched) return null;
    return {
        id: matched.id,
        template_kind: matched.template_kind,
        trigger: toPopupTrigger(matched),
        content: matched.content,
        dismissal_ttl_seconds: matched.dismissal_ttl_seconds,
    };
}
