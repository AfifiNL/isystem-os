"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { createClient } from "@/shared/lib/supabase/server";
import {
    computeTaskDueState,
    frequencyLabelToKind,
    isTaskOnTrack,
    type FrequencyKind,
} from "@/features/portal/lib/sla-overdue";

export interface CleaningSchedule {
    id: string;
    task_name: string;
    frequency: string | null;
    frequency_kind: FrequencyKind;
    frequency_value_days: number | null;
    grace_period_days: number;
    last_completed_at: string | null;
    status: "compliant" | "pending" | "issue";
    created_at: string;
    /** Populated by reads that join cleaning_schedule_notes. Optional so old
     * consumers don't have to know about it. */
    notes_count?: number;
    /** Notes posted by portal clients with is_flag=true and no manager
     * is_resolution follow-up. */
    unresolved_flags_count?: number;
}

export interface FacilityLocation {
    id: string;
    name: string;
    address: string | null;
    created_at: string;
    cleaning_schedules: CleaningSchedule[];
}

export interface FacilityDataResult {
    locations: FacilityLocation[];
    slaPercentage: number;
    totalTasks: number;
    compliantTasks: number;
    onTrackTasks: number;
    overdueTasks: number;
    companyName: string | null;
}

export interface PortalClientWithLocations {
    id: string;
    company_name: string | null;
    workspace_id: string;
    profile_id: string | null;
    locations: FacilityLocation[];
    slaPercentage: number;
    totalTasks: number;
    /** Tasks whose persisted `status` field is 'compliant', irrespective of deadline. */
    compliantTasks: number;
    /** compliant AND not overdue — used for the SLA % numerator. */
    onTrackTasks: number;
    overdueTasks: number;
}

export interface PortalClientListItem extends PortalClientWithLocations {
    created_at: string;
    linked_profile_email: string | null;
    linked_profile_role: string | null;
    antiAbuseRiskLevel: "low" | "medium" | "high" | "critical" | null;
    antiAbuseRiskScore: number | null;
    antiAbuseFlaggedSubmissions: number;
}

export interface PortalClientDetail extends PortalClientListItem {
    locationsSummary: Array<{
        id: string;
        name: string;
        address: string | null;
        created_at: string;
        totalTasks: number;
        compliantTasks: number;
        onTrackTasks: number;
        overdueTasks: number;
        slaPercentage: number;
    }>;
}

interface PortalClientRiskSummary {
    riskLevel: PortalClientListItem["antiAbuseRiskLevel"];
    riskScore: number | null;
    flaggedSubmissions: number;
}

export interface ClientLocationSlaSummary {
    clientId: string;
    companyName: string | null;
    totalLocations: number;
    totalTasks: number;
    compliantTasks: number;
    onTrackTasks: number;
    overdueTasks: number;
    slaPercentage: number;
    locations: PortalClientDetail["locationsSummary"];
}

export interface PortalClientRecord {
    id: string;
    workspace_id: string;
    profile_id: string | null;
    company_name: string | null;
    created_at: string;
}

export interface ProfileOption {
    id: string;
    email: string;
    role: string;
}

interface UpdatePortalClientInput {
    companyName?: string;
    profileId?: string | null;
}

interface CreatePortalClientInput {
    companyName: string;
    profileId?: string | null;
}

type RawClientWithLocations = {
    id: string;
    company_name: string | null;
    workspace_id: string;
    profile_id: string | null;
    created_at?: string;
    facility_locations?: FacilityLocation[];
};

type RawWorkspaceSlaTask = Omit<CleaningSchedule, "status"> & {
    status: "completed" | "compliant" | "pending" | "issue";
};

type RawWorkspaceClientProject = {
    id: string;
    name: string;
    address: string | null;
    created_at: string;
    workspace_sla_tasks?: RawWorkspaceSlaTask[] | null;
};

type RawPortalClientWithProjects = {
    id: string;
    company_name: string | null;
    workspace_id: string;
    profile_id: string | null;
    created_at?: string;
    workspace_client_projects?: RawWorkspaceClientProject[] | null;
};

type PortalClientDeleteLookup = {
    id: string;
    workspace_id: string;
    workspace_client_projects?: Array<{
        id: string;
        workspace_sla_tasks?: Array<{ id: string }> | null;
    }> | null;
};

type SupabaseCountSelectBuilder = {
    select: (columns: string, options: { count: "exact" }) => {
        eq: (column: string, value: string) => SupabaseCountSelectBuilderResult;
    };
};

type SupabaseCountSelectBuilderResult = {
    ilike: (column: string, pattern: string) => SupabaseCountSelectBuilderResult;
    order: (column: string, options: { ascending: boolean }) => {
        range: (from: number, to: number) => Promise<{
            data: RawPortalClientWithProjects[] | null;
            count: number | null;
            error: { message: string } | null;
        }>;
    };
};

function mapWorkspaceSlaTask(task: RawWorkspaceSlaTask): CleaningSchedule {
    return {
        id: task.id,
        task_name: task.task_name,
        frequency: task.frequency,
        frequency_kind: task.frequency_kind,
        frequency_value_days: task.frequency_value_days,
        grace_period_days: task.grace_period_days,
        last_completed_at: task.last_completed_at,
        status: task.status === "completed" ? "compliant" : task.status,
        created_at: task.created_at,
    };
}

function mapWorkspaceClientProject(project: RawWorkspaceClientProject): FacilityLocation {
    return {
        id: project.id,
        name: project.name,
        address: project.address,
        created_at: project.created_at,
        cleaning_schedules: (project.workspace_sla_tasks ?? []).map(mapWorkspaceSlaTask),
    };
}

function mapPortalClientProjects(client: RawPortalClientWithProjects): RawClientWithLocations {
    return {
        id: client.id,
        company_name: client.company_name,
        workspace_id: client.workspace_id,
        profile_id: client.profile_id,
        created_at: client.created_at,
        facility_locations: (client.workspace_client_projects ?? []).map(mapWorkspaceClientProject),
    };
}

function mapLocation(location: FacilityLocation): FacilityLocation {
    return {
        id: location.id,
        name: location.name,
        address: location.address,
        created_at: location.created_at,
        cleaning_schedules: location.cleaning_schedules ?? [],
    };
}

function buildLocationSummary(location: FacilityLocation, now: Date = new Date()) {
    const safeLocation = mapLocation(location);
    const totalTasks = safeLocation.cleaning_schedules.length;
    let compliantTasks = 0;
    let onTrackTasks = 0;
    let overdueTasks = 0;

    for (const task of safeLocation.cleaning_schedules) {
        if (task.status === "compliant") compliantTasks++;
        const state = computeTaskDueState(task, now);
        if (state.isOnTrack) onTrackTasks++;
        if (state.isOverdue) overdueTasks++;
    }

    // SLA % is the share of tasks that are *on track* (compliant and not
    // overdue). A task marked compliant 18 months ago no longer counts.
    const slaPercentage = totalTasks > 0 ? Math.round((onTrackTasks / totalTasks) * 1000) / 10 : 100;

    return {
        id: safeLocation.id,
        name: safeLocation.name,
        address: safeLocation.address,
        created_at: safeLocation.created_at,
        totalTasks,
        compliantTasks,
        onTrackTasks,
        overdueTasks,
        slaPercentage,
    };
}

function mapPortalClientWithLocations(client: RawClientWithLocations, now: Date = new Date()): PortalClientWithLocations {
    const locations = (client.facility_locations ?? []).map((location) => mapLocation(location));

    let totalTasks = 0;
    let compliantTasks = 0;
    let onTrackTasks = 0;
    let overdueTasks = 0;

    for (const location of locations) {
        for (const task of location.cleaning_schedules) {
            totalTasks++;
            if (task.status === "compliant") compliantTasks++;
            const state = computeTaskDueState(task, now);
            if (state.isOnTrack) onTrackTasks++;
            if (state.isOverdue) overdueTasks++;
        }
    }

    const slaPercentage = totalTasks > 0 ? Math.round((onTrackTasks / totalTasks) * 1000) / 10 : 100;

    return {
        id: client.id,
        company_name: client.company_name,
        workspace_id: client.workspace_id,
        profile_id: client.profile_id,
        locations,
        slaPercentage,
        totalTasks,
        compliantTasks,
        onTrackTasks,
        overdueTasks,
    };
}

async function fetchProfilesByIds(profileIds: string[]): Promise<Map<string, ProfileOption>> {
    if (profileIds.length === 0) {
        return new Map();
    }

    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, email, role")
        .in("id", profileIds);

    if (error) {
        console.error("fetchProfilesByIds error:", error);
        return new Map();
    }

    return new Map((data ?? []).map((profile) => [profile.id, profile as ProfileOption]));
}

async function fetchAntiAbuseRiskByPortalClientIds(workspaceId: string, clientIds: string[]): Promise<Map<string, PortalClientRiskSummary>> {
    if (clientIds.length === 0) {
        return new Map();
    }

    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data, error } = await supabaseAdmin
        .from("anti_abuse_events")
        .select("portal_client_id, risk_level, risk_score, decision")
        .eq("workspace_id", workspaceId)
        .in("portal_client_id", clientIds);

    if (error) {
        console.error("fetchAntiAbuseRiskByPortalClientIds error:", error);
        return new Map();
    }

    const riskMap = new Map<string, PortalClientRiskSummary>();

    for (const event of data ?? []) {
        if (!event.portal_client_id) {
            continue;
        }

        const current = riskMap.get(event.portal_client_id) ?? {
            riskLevel: null,
            riskScore: null,
            flaggedSubmissions: 0,
        };
        const nextScore = typeof event.risk_score === "number" ? event.risk_score : 0;
        const nextLevel = (event.risk_level as PortalClientRiskSummary["riskLevel"]) ?? current.riskLevel;

        riskMap.set(event.portal_client_id, {
            riskLevel: (current.riskScore ?? -1) <= nextScore ? nextLevel : current.riskLevel,
            riskScore: Math.max(current.riskScore ?? 0, nextScore),
            flaggedSubmissions: current.flaggedSubmissions + (event.decision !== "allow" || nextScore >= 45 ? 1 : 0),
        });
    }

    return riskMap;
}

export async function fetchFacilityDataForMembership(
    membershipId: string,
    workspaceId: string,
    companyName: string | null,
): Promise<{ data: FacilityDataResult; error: null } | { data: null; error: string }> {
    const supabase = await createClient();

    const { data: locations, error: locError } = await supabase
        .from("workspace_client_projects")
        .select(
            `
            id,
            name,
            address,
            created_at,
            workspace_sla_tasks (
                id,
                task_name,
                frequency,
                frequency_kind,
                frequency_value_days,
                grace_period_days,
                last_completed_at,
                status,
                created_at
            )
        `,
        )
        .eq("client_id", membershipId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

    if (locError) {
        console.error("fetchFacilityDataForMembership error:", locError);
        return { data: null, error: "Failed to fetch facility data" };
    }

    const now = new Date();
    let totalTasks = 0;
    let compliantTasks = 0;
    let onTrackTasks = 0;
    let overdueTasks = 0;

    const safeLocations: FacilityLocation[] = ((locations ?? []) as RawWorkspaceClientProject[]).map((loc) => {
        const schedules = (loc.workspace_sla_tasks ?? []).map(mapWorkspaceSlaTask);
        for (const schedule of schedules) {
            totalTasks++;
            if (schedule.status === "compliant") compliantTasks++;
            if (isTaskOnTrack(schedule, now)) onTrackTasks++;
            if (computeTaskDueState(schedule, now).isOverdue) overdueTasks++;
        }

        return {
            id: loc.id,
            name: loc.name,
            address: loc.address,
            created_at: loc.created_at,
            cleaning_schedules: schedules,
        };
    });

    const slaPercentage = totalTasks > 0 ? Math.round((onTrackTasks / totalTasks) * 1000) / 10 : 100;

    return {
        data: JSON.parse(
            JSON.stringify({
                locations: safeLocations,
                slaPercentage,
                totalTasks,
                compliantTasks,
                onTrackTasks,
                overdueTasks,
                companyName,
            }),
        ) as FacilityDataResult,
        error: null,
    };
}

export async function fetchMyFacilityData(): Promise<
    { data: FacilityDataResult; error: null } | { data: null; error: string }
> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            data: {
                locations: [],
                slaPercentage: 100,
                totalTasks: 0,
                compliantTasks: 0,
                onTrackTasks: 0,
                overdueTasks: 0,
                companyName: null,
            },
            error: null,
        };
    }

    const { data: portalUser, error: portalError } = await supabase
        .from("client_portal_users")
        .select("id, workspace_id, company_name")
        .eq("profile_id", user.id)
        .limit(1)
        .maybeSingle();

    if (portalError) {
        console.error("Error fetching portal user:", portalError);
        return { data: null, error: "Failed to resolve portal access" };
    }

    if (!portalUser) {
        return {
            data: {
                locations: [],
                slaPercentage: 100,
                totalTasks: 0,
                compliantTasks: 0,
                onTrackTasks: 0,
                overdueTasks: 0,
                companyName: null,
            },
            error: null,
        };
    }

    const { data: locations, error: locError } = await supabase
        .from("workspace_client_projects")
        .select(
            `
            id,
            name,
            address,
            created_at,
            workspace_sla_tasks (
                id,
                task_name,
                frequency,
                frequency_kind,
                frequency_value_days,
                grace_period_days,
                last_completed_at,
                status,
                created_at
            )
        `,
        )
        .eq("client_id", portalUser.id)
        .eq("workspace_id", portalUser.workspace_id)
        .order("created_at", { ascending: true });

    if (locError) {
        console.error("Error fetching facility locations:", locError);
        return { data: null, error: "Failed to fetch facility data" };
    }

    let totalTasks = 0;
    let compliantTasks = 0;

    const safeLocations: FacilityLocation[] = ((locations ?? []) as RawWorkspaceClientProject[]).map((loc) => {
        const schedules = (loc.workspace_sla_tasks ?? []).map(mapWorkspaceSlaTask);
        totalTasks += schedules.length;
        compliantTasks += schedules.filter((schedule) => schedule.status === "compliant").length;

        return {
            id: loc.id,
            name: loc.name,
            address: loc.address,
            created_at: loc.created_at,
            cleaning_schedules: schedules,
        };
    });

    const slaPercentage = totalTasks > 0 ? Math.round((compliantTasks / totalTasks) * 1000) / 10 : 100;

    return {
        data: JSON.parse(
            JSON.stringify({
                locations: safeLocations,
                slaPercentage,
                totalTasks,
                compliantTasks,
                companyName: portalUser.company_name ?? null,
            }),
        ) as FacilityDataResult,
        error: null,
    };
}

export async function updateTaskStatus(
    taskId: string,
    status: "compliant" | "completed" | "pending" | "issue",
): Promise<{ data: CleaningSchedule | null; error: string | null }> {
    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { data: null, error: "Unauthorized" };
    }

    const supabase = await createClient();
    const dbStatus = status === "compliant" ? "completed" : status;
    const patch: Record<string, unknown> = { status: dbStatus };

    if (dbStatus === "completed") {
        patch.last_completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
        .from("workspace_sla_tasks")
        .update(patch)
        .eq("id", taskId)
        .select("id, task_name, frequency, frequency_kind, frequency_value_days, grace_period_days, last_completed_at, status, created_at")
        .single();

    if (error) {
        console.error("updateTaskStatus error:", error);
        return { data: null, error: "Failed to update task status" };
    }

    const mappedData = data ? {
        ...data,
        status: data.status === "completed" ? "compliant" : data.status,
    } : null;

    return { data: JSON.parse(JSON.stringify(mappedData)) as CleaningSchedule, error: null };
}

export async function createFacilityLocation(
    clientId: string,
    name: string,
    address: string,
): Promise<{ data: FacilityLocation | null; error: string | null }> {
    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { data: null, error: "Unauthorized" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_client_projects")
        .insert({
            client_id: clientId,
            workspace_id: state.workspace.id,
            name: name.trim(),
            address: address.trim() || null,
        })
        .select("id, name, address, created_at")
        .single();

    if (error) {
        console.error("createFacilityLocation error:", error);
        return { data: null, error: "Failed to create location" };
    }

    revalidatePath("/dashboard/slas");

    return {
        data: JSON.parse(JSON.stringify({ ...data, cleaning_schedules: [] })) as FacilityLocation,
        error: null,
    };
}

export interface CreateCleaningTaskOptions {
    frequencyKind?: FrequencyKind;
    frequencyValueDays?: number | null;
    gracePeriodDays?: number;
}

export async function createCleaningTask(
    locationId: string,
    taskName: string,
    frequency: string,
    options: CreateCleaningTaskOptions = {},
): Promise<{ data: CleaningSchedule | null; error: string | null }> {
    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { data: null, error: "Unauthorized" };
    }

    // Caller may pass an explicit structured kind (preferred) or let us derive
    // it from the human-readable label so legacy callers keep working.
    const frequencyKind: FrequencyKind = options.frequencyKind
        ?? frequencyLabelToKind(frequency);

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_sla_tasks")
        .insert({
            project_id: locationId,
            task_name: taskName.trim(),
            frequency: frequency.trim() || null,
            frequency_kind: frequencyKind,
            frequency_value_days: options.frequencyValueDays ?? null,
            grace_period_days: Math.max(0, Math.floor(options.gracePeriodDays ?? 0)),
            status: "pending" as const,
        })
        .select("id, task_name, frequency, frequency_kind, frequency_value_days, grace_period_days, last_completed_at, status, created_at")
        .single();

    if (error) {
        console.error("createCleaningTask error:", error);
        return { data: null, error: "Failed to create task" };
    }

    revalidatePath("/dashboard/slas");

    const mappedData = data ? {
        ...data,
        status: data.status === "completed" ? "compliant" : data.status,
    } : null;

    return { data: JSON.parse(JSON.stringify(mappedData)) as CleaningSchedule, error: null };
}

export interface PortalClientsQuery {
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface PortalClientsListResult {
    data: PortalClientListItem[];
    total: number;
    page: number;
    pageSize: number;
    error: string | null;
}

export async function listWorkspacePortalClients(
    query: PortalClientsQuery = {},
): Promise<PortalClientsListResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 25));
    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { data: [], total: 0, page, pageSize, error: "Unauthorized" };
    }

    const supabase = await createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let builder = (supabase.from("client_portal_users") as unknown as SupabaseCountSelectBuilder)
        .select(
            `
            id,
            company_name,
            workspace_id,
            profile_id,
            created_at,
            workspace_client_projects (
                id,
                name,
                address,
                created_at,
                workspace_sla_tasks (
                    id,
                    task_name,
                    frequency,
                    frequency_kind,
                    frequency_value_days,
                    grace_period_days,
                    last_completed_at,
                    status,
                    created_at
                )
            )
        `,
            { count: "exact" },
        )
        .eq("workspace_id", state.workspace.id);

    if (query.search && query.search.trim()) {
        const term = query.search.trim().replace(/[%_]/g, "\\$&");
        builder = builder.ilike("company_name", `%${term}%`);
    }

    const { data, count, error } = await builder
        .order("company_name", { ascending: true })
        .range(from, to);

    if (error) {
        return { data: [], total: 0, page, pageSize, error: error.message };
    }

    const typedClients = (data ?? []).map(mapPortalClientProjects);

    const profileIds = typedClients
        .map((client) => client.profile_id)
        .filter((profileId): profileId is string => Boolean(profileId));
    const [profileMap, antiAbuseRiskMap] = await Promise.all([
        fetchProfilesByIds(profileIds),
        fetchAntiAbuseRiskByPortalClientIds(state.workspace.id, typedClients.map((client) => client.id)),
    ]);

    const result: PortalClientListItem[] = typedClients.map((client) => {
        const mappedClient = mapPortalClientWithLocations(client);
        const linkedProfile = client.profile_id ? profileMap.get(client.profile_id) : null;

        return {
            ...mappedClient,
            created_at: client.created_at ?? new Date(0).toISOString(),
            linked_profile_email: linkedProfile?.email ?? null,
            linked_profile_role: linkedProfile?.role ?? null,
            antiAbuseRiskLevel: antiAbuseRiskMap.get(client.id)?.riskLevel ?? null,
            antiAbuseRiskScore: antiAbuseRiskMap.get(client.id)?.riskScore ?? null,
            antiAbuseFlaggedSubmissions: antiAbuseRiskMap.get(client.id)?.flaggedSubmissions ?? 0,
        };
    });

    return {
        data: JSON.parse(JSON.stringify(result)) as PortalClientListItem[],
        total: count ?? 0,
        page,
        pageSize,
        error: null,
    };
}

export async function fetchWorkspacePortalClients(): Promise<
    | { data: PortalClientListItem[]; error: null }
    | { data: null; error: string }
> {
    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { data: null, error: "Unauthorized" };
    }

    const supabase = await createClient();
    const { data: clients, error: clientsError } = await supabase
        .from("client_portal_users")
        .select(
            `
            id,
            company_name,
            workspace_id,
            profile_id,
            created_at,
            workspace_client_projects (
                id,
                name,
                address,
                created_at,
                workspace_sla_tasks (
                    id,
                    task_name,
                    frequency,
                    frequency_kind,
                    frequency_value_days,
                    grace_period_days,
                    last_completed_at,
                    status,
                    created_at
                )
            )
        `,
        )
        .eq("workspace_id", state.workspace.id)
        .order("company_name", { ascending: true });

    if (clientsError) {
        console.error("fetchWorkspacePortalClients error:", clientsError);
        return { data: null, error: "Failed to fetch client data" };
    }

    const typedClients = ((clients ?? []) as RawPortalClientWithProjects[]).map(mapPortalClientProjects);

    const profileIds = typedClients
        .map((client) => client.profile_id)
        .filter((profileId): profileId is string => Boolean(profileId));
    const [profileMap, antiAbuseRiskMap] = await Promise.all([
        fetchProfilesByIds(profileIds),
        fetchAntiAbuseRiskByPortalClientIds(state.workspace.id, typedClients.map((client) => client.id)),
    ]);

    const result: PortalClientListItem[] = typedClients.map((client) => {
        const mappedClient = mapPortalClientWithLocations(client);
        const linkedProfile = client.profile_id ? profileMap.get(client.profile_id) : null;

        return {
            ...mappedClient,
            created_at: client.created_at ?? new Date(0).toISOString(),
            linked_profile_email: linkedProfile?.email ?? null,
            linked_profile_role: linkedProfile?.role ?? null,
            antiAbuseRiskLevel: antiAbuseRiskMap.get(client.id)?.riskLevel ?? null,
            antiAbuseRiskScore: antiAbuseRiskMap.get(client.id)?.riskScore ?? null,
            antiAbuseFlaggedSubmissions: antiAbuseRiskMap.get(client.id)?.flaggedSubmissions ?? 0,
        };
    });

    return { data: JSON.parse(JSON.stringify(result)) as PortalClientListItem[], error: null };
}

export async function fetchPortalClientById(clientId: string): Promise<
    | { data: PortalClientDetail; error: null }
    | { data: null; error: string }
> {
    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { data: null, error: "Unauthorized" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("client_portal_users")
        .select(
            `
            id,
            company_name,
            workspace_id,
            profile_id,
            created_at,
            workspace_client_projects (
                id,
                name,
                address,
                created_at,
                workspace_sla_tasks (
                    id,
                    task_name,
                    frequency,
                    frequency_kind,
                    frequency_value_days,
                    grace_period_days,
                    last_completed_at,
                    status,
                    created_at
                )
            )
        `,
        )
        .eq("workspace_id", state.workspace.id)
        .eq("id", clientId)
        .maybeSingle();

    if (error) {
        console.error("fetchPortalClientById error:", error);
        return { data: null, error: "Failed to fetch client detail" };
    }

    if (!data) {
        return { data: null, error: "Client not found" };
    }

    const rawClient = mapPortalClientProjects(data as RawPortalClientWithProjects);
    const [profileMap, antiAbuseRiskMap] = await Promise.all([
        fetchProfilesByIds(rawClient.profile_id ? [rawClient.profile_id] : []),
        fetchAntiAbuseRiskByPortalClientIds(state.workspace.id, [rawClient.id]),
    ]);
    const linkedProfile = rawClient.profile_id ? profileMap.get(rawClient.profile_id) : null;
    const mappedClient = mapPortalClientWithLocations(rawClient);
    const risk = antiAbuseRiskMap.get(rawClient.id);

    const detail: PortalClientDetail = {
        ...mappedClient,
        created_at: rawClient.created_at ?? new Date(0).toISOString(),
        linked_profile_email: linkedProfile?.email ?? null,
        linked_profile_role: linkedProfile?.role ?? null,
        antiAbuseRiskLevel: risk?.riskLevel ?? null,
        antiAbuseRiskScore: risk?.riskScore ?? null,
        antiAbuseFlaggedSubmissions: risk?.flaggedSubmissions ?? 0,
        locationsSummary: mappedClient.locations.map((location) => buildLocationSummary(location)),
    };

    return { data: JSON.parse(JSON.stringify(detail)) as PortalClientDetail, error: null };
}

export interface PortalClientBookingSummary {
    id: string;
    public_reference: string;
    status: string;
    scheduled_start: string;
    scheduled_end: string;
    customer_full_name: string;
    customer_email: string;
}

// Used by the client detail console to render "Recent bookings" so a manager
// can see at a glance whether the account has activity beyond the SLA scope.
// Fed by booking_reservations.portal_client_id (the FK added in the
// 20260517100000 migration; rows pre-dating that backfill are linked via the
// metadata->>'provisionedPortalClientId' fallback during reads).
export async function fetchBookingsForPortalClient(
    clientId: string,
    limit = 5,
): Promise<{ data: PortalClientBookingSummary[]; error: string | null }> {
    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { data: [], error: "Unauthorized" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("booking_reservations")
        .select("id, public_reference, status, scheduled_start, scheduled_end, customer_full_name, customer_email")
        .eq("workspace_id", state.workspace.id)
        .eq("portal_client_id", clientId)
        .order("scheduled_start", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("fetchBookingsForPortalClient error:", error);
        return { data: [], error: "Failed to fetch bookings" };
    }

    return {
        data: JSON.parse(JSON.stringify(data ?? [])) as PortalClientBookingSummary[],
        error: null,
    };
}

export async function fetchClientLocationsSlaSummary(clientId: string): Promise<
    | { data: ClientLocationSlaSummary; error: null }
    | { data: null; error: string }
> {
    const result = await fetchPortalClientById(clientId);

    if (result.error || !result.data) {
        return result;
    }

    return {
        data: {
            clientId: result.data.id,
            companyName: result.data.company_name,
            totalLocations: result.data.locations.length,
            totalTasks: result.data.totalTasks,
            compliantTasks: result.data.compliantTasks,
            onTrackTasks: result.data.onTrackTasks,
            overdueTasks: result.data.overdueTasks,
            slaPercentage: result.data.slaPercentage,
            locations: result.data.locationsSummary,
        },
        error: null,
    };
}

export async function fetchAvailableProfiles(): Promise<
    | { data: ProfileOption[]; error: null }
    | { data: null; error: string }
> {
    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { data: null, error: "Unauthorized" };
    }

    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data, error } = await supabaseAdmin.from("profiles").select("id, email, role").order("email", { ascending: true });

    if (error) {
        console.error("fetchAvailableProfiles error:", error);
        return { data: null, error: "Failed to fetch profiles" };
    }

    return { data: JSON.parse(JSON.stringify(data ?? [])) as ProfileOption[], error: null };
}

export async function createPortalClient(
    companyName: string,
    profileId: string | null,
): Promise<{ data: PortalClientRecord | null; error: string | null }> {
    return createPortalClientWithProfile({ companyName, profileId });
}

export async function createPortalClientWithProfile(
    input: CreatePortalClientInput,
): Promise<{ data: PortalClientRecord | null; error: string | null }> {
    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { data: null, error: "Unauthorized" };
    }

    if (!input.companyName.trim()) {
        return { data: null, error: "Company name is required" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("client_portal_users")
        .insert({
            workspace_id: state.workspace.id,
            company_name: input.companyName.trim(),
            profile_id: input.profileId ?? null,
        })
        .select("id, workspace_id, profile_id, company_name, created_at")
        .single();

    if (error) {
        console.error("createPortalClient error:", error);
        return { data: null, error: "Failed to create portal client" };
    }

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/slas");

    return { data: JSON.parse(JSON.stringify(data)) as PortalClientRecord, error: null };
}

export async function updatePortalClientProfile(
    clientId: string,
    profileId: string | null,
): Promise<{ data: PortalClientRecord | null; error: string | null }> {
    return updatePortalClient(clientId, { profileId });
}

export async function updatePortalClient(
    clientId: string,
    input: UpdatePortalClientInput,
): Promise<{ data: PortalClientRecord | null; error: string | null }> {
    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { data: null, error: "Unauthorized" };
    }

    const patch: Record<string, string | null> = {};

    if (typeof input.companyName === "string") {
        const companyName = input.companyName.trim();
        if (!companyName) {
            return { data: null, error: "Company name is required" };
        }
        patch.company_name = companyName;
    }

    if (Object.prototype.hasOwnProperty.call(input, "profileId")) {
        patch.profile_id = input.profileId ?? null;
    }

    if (Object.keys(patch).length === 0) {
        return { data: null, error: "No client updates provided" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("client_portal_users")
        .update(patch)
        .eq("id", clientId)
        .eq("workspace_id", state.workspace.id)
        .select("id, workspace_id, profile_id, company_name, created_at")
        .maybeSingle();

    if (error) {
        console.error("updatePortalClient error:", error);
        return { data: null, error: "Failed to update portal client" };
    }

    if (!data) {
        return { data: null, error: "Client not found in this workspace" };
    }

    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${clientId}`);
    revalidatePath("/dashboard/slas");
    revalidatePath(`/dashboard/slas/${clientId}`);

    return { data: JSON.parse(JSON.stringify(data)) as PortalClientRecord, error: null };
}

export async function deletePortalClient(
    clientId: string,
): Promise<{ data: { id: string } | null; error: string | null }> {
    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { data: null, error: "Unauthorized" };
    }

    const supabase = await createClient();
    const { data: client, error: clientError } = await supabase
        .from("client_portal_users")
        .select(
            `
            id,
            workspace_id,
            workspace_client_projects (
                id,
                workspace_sla_tasks ( id )
            )
        `,
        )
        .eq("workspace_id", state.workspace.id)
        .eq("id", clientId)
        .maybeSingle();

    if (clientError) {
        console.error("deletePortalClient lookup error:", clientError);
        return { data: null, error: "Failed to inspect client before deletion" };
    }

    if (!client) {
        return { data: null, error: "Client not found in this workspace" };
    }

    const locations = ((client as PortalClientDeleteLookup).workspace_client_projects ?? []).map((wcp) => ({
        id: wcp.id,
        cleaning_schedules: wcp.workspace_sla_tasks ?? [],
    }));
    const locationCount = locations.length;
    const taskCount = locations.reduce((total, location) => total + (location.cleaning_schedules?.length ?? 0), 0);

    if (locationCount > 0 || taskCount > 0) {
        return {
            data: null,
            error: `Delete blocked: this client still has ${locationCount} location${locationCount === 1 ? "" : "s"} and ${taskCount} task${taskCount === 1 ? "" : "s"}. Remove SLA operations data first.`,
        };
    }

    const { error: deleteError } = await supabase.from("client_portal_users").delete().eq("id", clientId).eq("workspace_id", state.workspace.id);

    if (deleteError) {
        console.error("deletePortalClient error:", deleteError);
        return { data: null, error: "Failed to delete portal client" };
    }

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/slas");

    return { data: { id: clientId }, error: null };
}

/**
 * Bulk-delete portal clients. Mirrors the safety contract of the single-row
 * delete: clients with attached facility locations or cleaning schedules are
 * skipped — never silently nuked — because removing them would orphan SLA
 * operations data. Returns counts so the UI can explain what happened.
 *
 * Returns:
 *   - deleted     : how many rows actually disappeared
 *   - skipped     : how many were rejected for safety
 *   - skippedReason: a one-line message naming the reason
 *   - error       : populated on auth failure or DB error; null on partial
 *                   success (skipped > 0 but deleted may also be > 0)
 */
export async function bulkDeletePortalClients(
    ids: readonly string[],
): Promise<{
    error: string | null;
    deleted: number;
    skipped: number;
    skippedReason: string | null;
}> {
    const cleaned = Array.from(
        new Set((ids ?? []).filter((id) => typeof id === "string" && id.length > 0)),
    );
    if (cleaned.length === 0) {
        return { error: null, deleted: 0, skipped: 0, skippedReason: null };
    }

    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { error: "Unauthorized", deleted: 0, skipped: 0, skippedReason: null };
    }

    const supabase = await createClient();
    const { data: rows, error: lookupError } = await supabase
        .from("client_portal_users")
        .select(
            `
            id,
            workspace_id,
            workspace_client_projects (
                id,
                workspace_sla_tasks ( id )
            )
        `,
        )
        .eq("workspace_id", state.workspace.id)
        .in("id", cleaned);

    if (lookupError) {
        console.error("bulkDeletePortalClients lookup error:", lookupError);
        return {
            error: "Failed to inspect clients before deletion",
            deleted: 0,
            skipped: 0,
            skippedReason: null,
        };
    }

    const inWorkspace = ((rows ?? []) as PortalClientDeleteLookup[]).map((client) => ({
        id: client.id,
        facility_locations: (client.workspace_client_projects ?? []).map((wcp) => ({
            id: wcp.id,
            cleaning_schedules: wcp.workspace_sla_tasks ?? [],
        })),
    }));

    const deletable: string[] = [];
    let skippedForData = 0;
    for (const client of inWorkspace) {
        const locations = client.facility_locations ?? [];
        const taskCount = locations.reduce(
            (total, location) => total + (location.cleaning_schedules?.length ?? 0),
            0,
        );
        if (locations.length === 0 && taskCount === 0) {
            deletable.push(client.id);
        } else {
            skippedForData += 1;
        }
    }

    const skippedNotFound = cleaned.length - inWorkspace.length;
    const skipped = skippedForData + skippedNotFound;
    const reasonParts: string[] = [];
    if (skippedForData > 0) {
        reasonParts.push(
            `${skippedForData} still have${skippedForData === 1 ? "s" : ""} attached locations or SLA tasks — clear those first`,
        );
    }
    if (skippedNotFound > 0) {
        reasonParts.push(`${skippedNotFound} not found in this workspace`);
    }
    const skippedReason = reasonParts.length > 0 ? reasonParts.join("; ") : null;

    if (deletable.length === 0) {
        return { error: null, deleted: 0, skipped, skippedReason };
    }

    const { data: deletedRows, error: deleteError } = await supabase
        .from("client_portal_users")
        .delete()
        .eq("workspace_id", state.workspace.id)
        .in("id", deletable)
        .select("id");

    if (deleteError) {
        console.error("bulkDeletePortalClients error:", deleteError);
        return {
            error: deleteError.message ?? "Failed to delete portal clients",
            deleted: 0,
            skipped,
            skippedReason,
        };
    }

    const deleted = deletedRows?.length ?? 0;
    // RLS denial returns 0 rows without an error — surface it so a missing
    // delete-policy migration is obvious instead of a silent no-op.
    if (deleted === 0 && deletable.length > 0) {
        return {
            error:
                "Delete was blocked by row-level security. Ask an admin to verify the client_portal_users delete policy.",
            deleted: 0,
            skipped,
            skippedReason,
        };
    }

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/slas");

    return { error: null, deleted, skipped, skippedReason };
}
