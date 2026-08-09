"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Loader2, Briefcase, Plus, ChevronRight, Layout, Search, Building2, Server } from "lucide-react";
import { AppCommandBar } from "@/features/admin/ui/app-workbench";
import { createWorkspace } from "@/features/admin/actions/workspaces";
import {
    FilterChip,
    PageSizeSelect,
    Pagination,
    PaginationStatus,
    useUrlFilters,
} from "@/shared/ui/list-controls";

interface WorkspaceListProps {
    workspaces: Array<{
        id: string;
        name: string;
        slug: string;
        workspace_tier: "basic" | "pro";
        is_active: boolean;
        created_at: string;
        owner?: { email?: string | null } | { email?: string | null }[] | null;
        bindings?: Array<{
            is_active: boolean;
            effective_to: string | null;
            theme_version?: {
                version: string;
                theme?: { name: string } | { name: string }[] | null;
            } | {
                version: string;
                theme?: { name: string } | { name: string }[] | null;
            }[] | null;
        }> | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
    search: string;
    tiers: string[];
    isActive: "all" | "active" | "inactive";
    tierCounts: Record<string, number>;
}

export function WorkspacesList({
    workspaces,
    total,
    page,
    pageSize,
    search,
    tiers,
    isActive,
    tierCounts,
}: WorkspaceListProps) {
    const router = useRouter();
    const { updateParams } = useUrlFilters();
    const [isPending, startTransition] = useTransition();
    const [isCreating, setIsCreating] = useState(false);

    const [newName, setNewName] = useState("");
    const [newSlug, setNewSlug] = useState("");
    const [error, setError] = useState<string | null>(null);

    const [searchDraft, setSearchDraft] = useState(search);

    useEffect(() => setSearchDraft(search), [search]);

    const submitSearch = (value: string) => {
        const trimmed = value.trim();
        if (trimmed === search) return;
        updateParams({ q: trimmed || null, page: null });
    };

    const toggleTier = (tier: string) => {
        const next = tiers.includes(tier) ? tiers.filter((t) => t !== tier) : [...tiers, tier];
        updateParams({ tier: next.length ? next.join(",") : null, page: null });
    };

    const setIsActiveFilter = (next: "all" | "active" | "inactive") => {
        updateParams({ active: next === "all" ? null : next, page: null });
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filteredWorkspaces = workspaces;

    const handleCreate = () => {
        if (!newName.trim() || !newSlug.trim()) {
            setError("Name and slug are required.");
            return;
        }

        setError(null);
        startTransition(async () => {
            const result = await createWorkspace({
                name: newName,
                slug: newSlug,
            });

            if (result.error) {
                setError(result.error);
                return;
            }

            setIsCreating(false);
            setNewName("");
            setNewSlug("");

            const createdWorkspaceId = result.data && typeof result.data === "object" && "id" in result.data
                ? result.data.id
                : null;

            if (workspaces.length === 0 && typeof createdWorkspaceId === "string") {
                router.push("/dashboard");
                router.refresh();
                return;
            }

            router.refresh();
        });
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col animate-in fade-in duration-500">
            <AppCommandBar>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Find tenant..."
                            value={searchDraft}
                            onChange={(e) => setSearchDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") submitSearch(searchDraft);
                            }}
                            onBlur={() => submitSearch(searchDraft)}
                            className="pl-9 rounded-md bg-background/80 text-[15px] focus:border-primary/50"
                        />
                    </div>
                    <Button onClick={() => setIsCreating(!isCreating)} className="shadow-sm transition-transform active:scale-95 shrink-0">
                        {isCreating ? "Cancel" : <><Plus className="mr-2 h-4 w-4" /> New Tenant</>}
                    </Button>
                </div>
            </AppCommandBar>

            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/30 px-4 py-3">
                <span className="text-[14px] font-semibold uppercase text-muted-foreground">Tier</span>
                <FilterChip
                    active={tiers.includes("basic")}
                    onClick={() => toggleTier("basic")}
                    label={
                        <span className="inline-flex items-center gap-1">
                            Basic
                            <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-semibold">
                                {tierCounts.basic ?? 0}
                            </span>
                        </span>
                    }
                />
                <FilterChip
                    active={tiers.includes("pro")}
                    onClick={() => toggleTier("pro")}
                    label={
                        <span className="inline-flex items-center gap-1">
                            Pro
                            <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-semibold">
                                {tierCounts.pro ?? 0}
                            </span>
                        </span>
                    }
                />
                <span className="ml-4 text-[14px] font-semibold uppercase text-muted-foreground">Status</span>
                {(["all", "active", "inactive"] as const).map((s) => (
                    <FilterChip
                        key={s}
                        active={isActive === s}
                        onClick={() => setIsActiveFilter(s)}
                        label={s}
                    />
                ))}
                <div className="ml-auto flex items-center gap-3 text-[15px]">
                    <PaginationStatus page={page} pageSize={pageSize} total={total} />
                    <PageSizeSelect
                        value={pageSize}
                        onChange={(v) => updateParams({ pageSize: String(v), page: null })}
                    />
                </div>
            </div>

            {/* Create Form Dropdown */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {isCreating && (
                <div className="mb-4 space-y-5 rounded-md border border-primary/20 bg-card/70 p-5 shadow-sm animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                        <Server className="h-5 w-5 text-primary" />
                        <h2 className="text-[15px] font-bold uppercase text-foreground">Provision New Tenant</h2>
                    </div>

                    {error && (
                        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-[15px] font-medium text-destructive">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="text-[15px] font-bold uppercase text-muted-foreground">Tenant Name</label>
                            <Input
                                value={newName}
                                onChange={(e) => {
                                    setNewName(e.target.value);
                                    if (!newSlug) {
                                        setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                                    }
                                }}
                                placeholder="E.g., Tech Startup Beta"
                                className="rounded-md bg-background/80 text-[15px] focus:bg-background transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[15px] font-bold uppercase text-muted-foreground">Routing Slug</label>
                            <Input
                                value={newSlug}
                                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}
                                placeholder="tech-startup-beta"
                                className="rounded-md bg-background/80 font-mono text-[15px] focus:bg-background transition-colors"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setIsCreating(false)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={isPending || !newName || !newSlug} className="min-w-[140px]">
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Server className="mr-2 h-4 w-4" />}
                            {isPending ? 'Provisioning...' : 'Provision Tenant'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Tenant Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {workspaces.length === 0 ? (
                    <div className="col-span-1 rounded-md border border-dashed border-border/50 bg-card/30 p-12 text-center xl:col-span-2">
                        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Building2 className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <h3 className="mb-1 text-[20px] font-bold text-foreground">No Tenants Found</h3>
                        <p className="mx-auto max-w-sm text-[15px] text-muted-foreground">
                            Provision your first workspace to begin managing resources and applying themes.
                        </p>
                    </div>
                ) : (
                    filteredWorkspaces.map((workspace) => {
                        const activeBinding = workspace.bindings?.find(b => b.is_active && !b.effective_to);
                        const themeVersion = Array.isArray(activeBinding?.theme_version)
                            ? activeBinding.theme_version[0]
                            : activeBinding?.theme_version;
                        const themeNameObj = Array.isArray(themeVersion?.theme)
                            ? themeVersion.theme[0]
                            : themeVersion?.theme;

                        const themeName = themeNameObj?.name ?? "No Theme Assigned";

                        return (
                            <Link
                                key={workspace.id}
                                href={`/dashboard/workspaces/${workspace.id}`}
                                className="group relative flex flex-col items-start justify-between overflow-hidden rounded-md border border-border/60 bg-card/75 p-5 shadow-sm transition-all duration-200 hover:border-primary/40 sm:flex-row sm:items-center"
                            >
                                <div className="relative z-10 flex items-start gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/80 text-muted-foreground transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary">
                                        <Briefcase className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-[20px] font-bold text-foreground transition-colors duration-200 group-hover:text-primary">
                                                {workspace.name}
                                            </h3>
                                            <span className={`rounded-md px-2.5 py-0.5 text-[13px] font-bold uppercase border ${workspace.workspace_tier === "pro"
                                                ? "bg-primary/10 text-primary border-primary/20"
                                                : "bg-slate-100 text-slate-700 border-slate-200"
                                                }`}>
                                                {workspace.workspace_tier}
                                            </span>
                                            {!workspace.is_active ? (
                                                <span className="rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-[13px] font-bold uppercase text-destructive">
                                                    Inactive
                                                </span>
                                            ) : (
                                                <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[13px] font-bold uppercase text-emerald-600">
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-[15px] text-muted-foreground">
                                            <span className="rounded-md bg-muted/50 px-1.5 font-mono text-foreground/70">/{workspace.slug}</span>
                                            <span className="flex items-center gap-1.5">
                                                <Layout className="h-3.5 w-3.5 opacity-70" />
                                                <span className="font-medium">{themeName}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative z-10 mt-4 sm:mt-0 flex items-center gap-5 sm:pl-4">
                                    <div className="hidden text-right sm:block">
                                        <p className="mb-0.5 text-[13px] font-semibold uppercase text-muted-foreground">Provisioned</p>
                                        <p className="text-[15px] font-medium text-foreground/80">{new Date(workspace.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                                        <ChevronRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
            {filteredWorkspaces.length === 0 && search && (
                <div className="rounded-md border border-dashed border-border/50 bg-card/30 p-8 text-center">
                    <p className="text-[15px] text-muted-foreground">No tenants match the search &quot;{search}&quot;.</p>
                </div>
            )}
            <Pagination
                page={page}
                totalPages={totalPages}
                onChange={(p) => updateParams({ page: p === 1 ? null : String(p) })}
            />
            </div>
        </div>
    );
}
