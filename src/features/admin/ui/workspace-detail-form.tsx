"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
    Loader2,
    Users,
    Layers,
    UserPlus,
    Sparkles,
} from "lucide-react";
import { DashboardAppWorkbench } from "@/features/admin/ui/app-workbench";
import {
    assignManagerToWorkspace,
    reassignManagerToWorkspace,
    revokeManagerAssignment,
    inviteManager,
} from "@/features/admin/actions/workspace-managers";
import { setActiveWorkspaceThemeVersion } from "@/features/admin/actions/workspace-theme";
import { updateWorkspaceComputeCredits, updateWorkspaceTier } from "@/features/admin/actions/workspaces";
import { topUpWorkspaceAiCredits, type WorkspaceAiSnapshot } from "@/features/admin/actions/ai-balance";
import { formatEur } from "@/shared/lib/ai/pricing";
import type { WorkspaceTier } from "@/shared/lib/workspace/context";

interface WorkspaceDetailFormProps {
    workspace: {
        id: string;
        name: string;
        slug: string;
        compute_credits: number;
        workspace_tier: WorkspaceTier;
    };
    aiSnapshot: WorkspaceAiSnapshot;
    activeTheme: {
        id: string;
        themeKey: string;
        themeName: string;
        version: string;
        status: string;
    } | null;
    themeVersions: Array<{
        id: string;
        themeName: string;
        version: string;
        isDefault: boolean;
    }>;
    managerAssignments: Array<{
        id: string;
        manager_profile_id: string;
        is_active: boolean;
        starts_at: string;
        manager?: { email?: string | null } | { email?: string | null }[];
    }>;
    managerProfiles: Array<{
        id: string;
        email: string | null;
    }>;
    accessibleWorkspaces: Array<{
        id: string;
        name: string;
    }>;
}

function resolveManagerEmail(
    manager: { email?: string | null } | { email?: string | null }[] | undefined,
): string {
    if (Array.isArray(manager)) {
        return manager[0]?.email ?? "Unknown manager";
    }
    return manager?.email ?? "Unknown manager";
}

export function WorkspaceDetailForm({
    workspace,
    aiSnapshot,
    activeTheme,
    themeVersions,
    managerAssignments,
    managerProfiles,
    accessibleWorkspaces,
}: WorkspaceDetailFormProps) {
    const router = useRouter();
    const [isThemePending, startThemeTransition] = useTransition();
    const [isManagerPending, startManagerTransition] = useTransition();

    const [nextThemeVersionId, setNextThemeVersionId] = useState(activeTheme?.id ?? "");
    const [computeCredits, setComputeCredits] = useState(workspace.compute_credits.toString());
    const [workspaceTier, setWorkspaceTier] = useState<WorkspaceTier>(workspace.workspace_tier);
    const [selectedManagerId, setSelectedManagerId] = useState(managerProfiles[0]?.id ?? "");
    const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({});

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteName, setInviteName] = useState("");
    const [invitePassword, setInvitePassword] = useState("");
    const [isInviting, setIsInviting] = useState(false);

    const [aiTopUpEuros, setAiTopUpEuros] = useState("");
    const [aiTopUpNotes, setAiTopUpNotes] = useState("");
    const [aiBalanceMillicents, setAiBalanceMillicents] = useState(aiSnapshot.balanceMillicents);
    const [isAiPending, startAiTransition] = useTransition();

    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleAiTopUp = () => {
        const parsed = Number.parseFloat(aiTopUpEuros);
        if (!Number.isFinite(parsed) || parsed === 0) {
            setError("Enter a non-zero euro amount (negative values debit the balance).");
            return;
        }

        setError(null);
        startAiTransition(async () => {
            const result = await topUpWorkspaceAiCredits({
                workspaceId: workspace.id,
                amountEuros: parsed,
                notes: aiTopUpNotes.trim() || undefined,
            });
            if (result.error || !result.data) {
                setError(result.error ?? "Failed to update AI balance.");
                return;
            }
            setAiBalanceMillicents(result.data.balanceMillicents);
            setAiTopUpEuros("");
            setAiTopUpNotes("");
            setSuccessMsg(`AI balance updated. New balance: ${formatEur(result.data.balanceMillicents)}`);
            router.refresh();
            setTimeout(() => setSuccessMsg(null), 4000);
        });
    };

    const handleThemeUpdate = () => {
        if (!nextThemeVersionId) {
            setError("Select a theme version before applying.");
            return;
        }

        setError(null);
        startThemeTransition(async () => {
            const result = await setActiveWorkspaceThemeVersion({
                workspaceId: workspace.id,
                themeVersionId: nextThemeVersionId,
            });

            if (result.error) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    };

    const handleInviteManager = () => {
        if (!inviteEmail || !inviteName) {
            setError("Email and Full Name are required to invite a manager.");
            return;
        }

        setError(null);
        startManagerTransition(async () => {
            const result = await inviteManager({
                email: inviteEmail,
                fullName: inviteName,
                password: invitePassword,
                workspaceId: workspace.id,
            });
            if (result.error) {
                setError(result.error);
                return;
            }

            setSuccessMsg(`Manager ${inviteEmail} invited and assigned to workspace successfully.`);
            setInviteEmail("");
            setInviteName("");
            setInvitePassword("");
            setIsInviting(false);
            router.refresh();
            setTimeout(() => setSuccessMsg(null), 3000);
        });
    };

    const handleComputeCreditsUpdate = () => {
        const parsed = Number.parseInt(computeCredits, 10);
        if (!Number.isInteger(parsed) || parsed < 0) {
            setError("Compute credits must be a non-negative integer.");
            return;
        }

        setError(null);
        startThemeTransition(async () => {
            const result = await updateWorkspaceComputeCredits({
                workspaceId: workspace.id,
                computeCredits: parsed,
            });

            if (result.error) {
                setError(result.error);
                return;
            }

            setSuccessMsg(`Compute credits updated to ${parsed}.`);
            router.refresh();
            setTimeout(() => setSuccessMsg(null), 3000);
        });
    };

    const handleWorkspaceTierUpdate = () => {
        setError(null);
        startThemeTransition(async () => {
            const result = await updateWorkspaceTier({
                workspaceId: workspace.id,
                workspaceTier,
            });

            if (result.error) {
                setError(result.error);
                return;
            }

            setSuccessMsg(`Workspace tier updated to ${workspaceTier}.`);
            router.refresh();
            setTimeout(() => setSuccessMsg(null), 3000);
        });
    };

    const handleAssignManager = () => {
        if (!selectedManagerId) {
            setError("Select a manager profile first.");
            return;
        }

        setError(null);
        startManagerTransition(async () => {
            const result = await assignManagerToWorkspace({
                workspaceId: workspace.id,
                managerProfileId: selectedManagerId,
            });

            if (result.error) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    };

    const handleReassign = (assignmentId: string, managerProfileId: string) => {
        const targetWorkspaceId = reassignTargets[assignmentId];

        if (!targetWorkspaceId) {
            setError("Select a target workspace before reassigning.");
            return;
        }

        setError(null);
        startManagerTransition(async () => {
            const result = await reassignManagerToWorkspace({
                managerProfileId,
                toWorkspaceId: targetWorkspaceId,
            });

            if (result.error) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    };

    const handleRevoke = (assignmentId: string) => {
        setError(null);
        startManagerTransition(async () => {
            const result = await revokeManagerAssignment({
                assignmentId,
                workspaceId: workspace.id,
            });

            if (result.error) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    };

    return (
        <DashboardAppWorkbench>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-[15px] font-medium text-destructive">
                    {error}
                </div>
            )}

            {successMsg && (
                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-[15px] font-medium text-emerald-600">
                    {successMsg}
                </div>
            )}

            <div className="space-y-4 rounded-md border bg-card p-5 shadow-sm">
                <div>
                    <h2 className="flex items-center gap-2 text-[15px] font-semibold uppercase text-foreground">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        Workspace Tier
                    </h2>
                    <p className="mt-1 text-[15px] text-muted-foreground">
                        Basic disables AI generation features. Pro unlocks the full AI workspace stack.
                    </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <select
                        value={workspaceTier}
                        onChange={(e) => setWorkspaceTier(e.target.value as WorkspaceTier)}
                        disabled={isThemePending}
                        className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    >
                        <option value="basic">Basic workspace</option>
                        <option value="pro">Pro workspace</option>
                    </select>
                    <Button onClick={handleWorkspaceTierUpdate} disabled={isThemePending}>
                        {isThemePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save tier
                    </Button>
                </div>
            </div>

            <div className="space-y-4 rounded-md border bg-card p-5 shadow-sm">
                <div>
                    <h2 className="flex items-center gap-2 text-[15px] font-semibold uppercase text-foreground">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        Workspace Theme
                    </h2>
                    <p className="mt-1 text-[15px] text-muted-foreground">
                        Active Theme: {activeTheme ? `${activeTheme.themeName} (${activeTheme.version})` : "None"}
                    </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <select
                        value={nextThemeVersionId}
                        onChange={(e) => setNextThemeVersionId(e.target.value)}
                        disabled={themeVersions.length === 0 || isThemePending}
                        className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    >
                        {themeVersions.map((version) => (
                            <option key={version.id} value={version.id}>
                                {version.themeName} · {version.version}
                                {version.isDefault ? " (default)" : ""}
                            </option>
                        ))}
                        {themeVersions.length === 0 ? <option value="">No versions available</option> : null}
                    </select>

                    <Button onClick={handleThemeUpdate} disabled={isThemePending || !nextThemeVersionId}>
                        {isThemePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Apply theme version
                    </Button>
                </div>
            </div>

            <div className="space-y-4 rounded-md border bg-card p-5 shadow-sm">
                <div>
                    <h2 className="text-[15px] font-semibold uppercase text-foreground">
                        Video Queue Credits
                    </h2>
                    <p className="mt-1 text-[15px] text-muted-foreground">
                        Integer credits consumed by video queue generation. Separate from the AI generation balance below.
                    </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <Input
                        type="number"
                        min={0}
                        step={1}
                        value={computeCredits}
                        onChange={(e) => setComputeCredits(e.target.value)}
                        disabled={isThemePending}
                        className="bg-background"
                    />
                    <Button onClick={handleComputeCreditsUpdate} disabled={isThemePending || computeCredits.trim().length === 0}>
                        {isThemePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save video credits
                    </Button>
                </div>
            </div>

            <div className="space-y-4 rounded-md border bg-card p-5 shadow-sm">
                <div>
                    <h2 className="flex items-center gap-2 text-[15px] font-semibold uppercase text-foreground">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        AI Generation Balance (€)
                    </h2>
                    <p className="mt-1 text-[15px] text-muted-foreground">
                        Monetary budget for Gemini-backed AI features (draft generator, voiceover, asset generation). Charged at Google cost + 7% platform fee. Independent of video queue credits above.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4 rounded-md bg-accent/30 p-4">
                    <div>
                        <p className="text-[15px] text-muted-foreground">Current balance</p>
                        <p className={`text-2xl font-semibold tabular-nums ${aiBalanceMillicents < 50_000 ? "text-destructive" : "text-foreground"}`}>
                            {formatEur(aiBalanceMillicents)}
                        </p>
                    </div>
                    <div>
                        <p className="text-[15px] text-muted-foreground">Spend (last 30 days)</p>
                        <p className="text-2xl font-semibold tabular-nums text-foreground">
                            {formatEur(aiSnapshot.spend30dMillicents)}
                        </p>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                    <Input
                        type="number"
                        step="0.01"
                        placeholder="Amount in €"
                        value={aiTopUpEuros}
                        onChange={(e) => setAiTopUpEuros(e.target.value)}
                        disabled={isAiPending}
                        className="bg-background"
                    />
                    <Input
                        type="text"
                        placeholder="Notes (optional) — e.g. 'Q2 top-up per MSA'"
                        value={aiTopUpNotes}
                        onChange={(e) => setAiTopUpNotes(e.target.value)}
                        disabled={isAiPending}
                        className="bg-background"
                    />
                    <Button onClick={handleAiTopUp} disabled={isAiPending || aiTopUpEuros.trim().length === 0}>
                        {isAiPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Apply
                    </Button>
                </div>

                {aiSnapshot.recentActivity.length > 0 && (
                    <div className="rounded-md border bg-background/50">
                        <p className="border-b px-4 py-2 text-[15px] font-medium text-muted-foreground">
                            Recent activity
                        </p>
                        <ul className="divide-y">
                            {aiSnapshot.recentActivity.slice(0, 10).map((entry) => {
                                const signed = entry.delta_millicents >= 0 ? "+" : "−";
                                const amount = formatEur(Math.abs(entry.delta_millicents));
                                const dt = new Date(entry.created_at);
                                return (
                                    <li key={entry.id} className="flex items-center justify-between px-4 py-2 text-[15px]">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{entry.reason.replace(/_/g, " ")}</span>
                                            {entry.notes && <span className="text-muted-foreground">{entry.notes}</span>}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="tabular-nums text-muted-foreground">{dt.toLocaleString()}</span>
                                            <span className={`tabular-nums font-semibold ${entry.delta_millicents >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                                                {signed}{amount}
                                            </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>

            <div className="space-y-4 rounded-md border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="flex items-center gap-2 text-[15px] font-semibold uppercase text-foreground">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            Workspace managers
                        </h2>
                        <p className="mt-1 text-[15px] text-muted-foreground">
                            Assign or revoke managers for {workspace.name}.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsInviting(!isInviting)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite Manager
                    </Button>
                </div>

                {isInviting && (
                    <div className="space-y-4 rounded-md border bg-accent/30 p-4">
                        <h3 className="text-[15px] font-semibold">Invite new manager</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-[15px] font-medium">Email</label>
                                <Input
                                    className="bg-background"
                                    type="email"
                                    placeholder="manager@example.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[15px] font-medium">Full Name</label>
                                <Input
                                    className="bg-background"
                                    placeholder="John Doe"
                                    value={inviteName}
                                    onChange={(e) => setInviteName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[15px] font-medium">Initial Password (Optional)</label>
                                <Input
                                    className="bg-background"
                                    type="text"
                                    placeholder="leave blank for email invite"
                                    value={invitePassword}
                                    onChange={(e) => setInvitePassword(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setIsInviting(false)} disabled={isManagerPending}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleInviteManager} disabled={isManagerPending || !inviteName || !inviteEmail}>
                                {isManagerPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                                Send Invite
                            </Button>
                        </div>
                    </div>
                )}

                <div className="grid gap-3 md:grid-cols-[1fr_auto] pt-2">
                    <select
                        value={selectedManagerId}
                        onChange={(e) => setSelectedManagerId(e.target.value)}
                        disabled={isManagerPending || managerProfiles.length === 0}
                        className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    >
                        {managerProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                                {profile.email ?? profile.id}
                            </option>
                        ))}
                        {managerProfiles.length === 0 ? <option value="">No manager profiles found</option> : null}
                    </select>
                    <Button
                        onClick={handleAssignManager}
                        disabled={isManagerPending || !selectedManagerId || managerProfiles.length === 0}
                    >
                        {isManagerPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Assign manager
                    </Button>
                </div>

                <div className="space-y-3 pt-4">
                    {managerAssignments.length > 0 ? (
                        managerAssignments.map((assignment) => (
                            <div
                                key={assignment.id}
                                className="rounded-md border border-border/60 bg-background px-4 py-3"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[15px] font-medium">
                                            {resolveManagerEmail(assignment.manager)}
                                        </p>
                                        <p className="text-[15px] text-muted-foreground">
                                            {assignment.is_active ? "Active" : "Inactive"} · started {new Date(assignment.starts_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRevoke(assignment.id)}
                                        disabled={!assignment.is_active || isManagerPending}
                                    >
                                        Revoke
                                    </Button>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                                    <select
                                        value={reassignTargets[assignment.id] ?? ""}
                                        onChange={(e) =>
                                            setReassignTargets((prev) => ({
                                                ...prev,
                                                [assignment.id]: e.target.value,
                                            }))
                                        }
                                        className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                        <option value="">Select target workspace</option>
                                        {accessibleWorkspaces.filter(w => w.id !== workspace.id).map((entry) => (
                                            <option key={entry.id} value={entry.id}>
                                                {entry.name}
                                            </option>
                                        ))}
                                    </select>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() =>
                                            handleReassign(assignment.id, assignment.manager_profile_id)
                                        }
                                        disabled={isManagerPending}
                                    >
                                        Reassign
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="rounded-md border border-dashed p-4 text-center text-[15px] text-muted-foreground">No manager assignments found for this workspace.</p>
                    )}
                </div>
            </div>
            </div>
        </DashboardAppWorkbench>
    );
}
