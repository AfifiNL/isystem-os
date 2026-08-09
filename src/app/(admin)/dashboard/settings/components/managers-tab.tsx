import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Users, Loader2 } from "lucide-react";

interface ManagersTabProps {
    canManageManagers: boolean;
    managerProfiles: Array<{ id: string; email: string | null }>;
    managerAssignments: Array<{
        id: string;
        manager_profile_id: string;
        is_active: boolean;
        starts_at: string;
        manager?: { email?: string | null } | { email?: string | null }[];
    }>;
    accessibleWorkspaces: Array<{ id: string; name: string }>;
    selectedManagerId: string;
    setSelectedManagerId: (id: string) => void;
    inviteEmail: string;
    setInviteEmail: (value: string) => void;
    inviteName: string;
    setInviteName: (value: string) => void;
    invitePassword: string;
    setInvitePassword: (value: string) => void;
    isManagerPending: boolean;
    handleInviteManager: () => void;
    handleAssignManager: () => void;
    handleRevoke: (id: string) => void;
    reassignTargets: Record<string, string>;
    setReassignTargets: (val: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
    handleReassign: (assignmentId: string, managerProfileId: string) => void;
    locale: string;
}

function resolveManagerEmail(manager: { email?: string | null } | { email?: string | null }[] | undefined): string {
    if (Array.isArray(manager)) {
        return manager[0]?.email ?? "Unknown manager";
    }
    return manager?.email ?? "Unknown manager";
}

function formatAssignmentStartDate(value: string, locale: string): string {
    const normalizedLocale = locale === "nl" ? "nl-NL" : "en-GB";
    return new Intl.DateTimeFormat(normalizedLocale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(value));
}

export function ManagersTab({
    canManageManagers,
    managerProfiles,
    managerAssignments,
    accessibleWorkspaces,
    selectedManagerId,
    setSelectedManagerId,
    inviteEmail,
    setInviteEmail,
    inviteName,
    setInviteName,
    invitePassword,
    setInvitePassword,
    isManagerPending,
    handleInviteManager,
    handleAssignManager,
    handleRevoke,
    reassignTargets,
    setReassignTargets,
    handleReassign,
    locale,
}: ManagersTabProps) {
    if (!canManageManagers) {
        return (
            <div className="space-y-4 rounded-md border bg-card p-5 shadow-sm animate-in fade-in">
                <p className="text-[17px] text-muted-foreground">
                    Manager lifecycle controls are only available to workspace owner admins.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 rounded-md border bg-card p-5 shadow-sm animate-in fade-in duration-300">
            <div>
                <h2 className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Workspace managers
                </h2>
                <p className="text-[15px] text-muted-foreground mt-1">
                    Assign, reassign, or revoke manager ownership for workspace execution.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="space-y-3 rounded-md border border-border/60 bg-background p-4 md:col-span-2">
                    <p className="text-[15px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Invite and assign manager</p>
                    <div className="grid gap-3 md:grid-cols-3">
                        <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name" />
                        <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="manager@company.com" type="email" />
                        <Input value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="Optional initial password" />
                    </div>
                    <Button onClick={handleInviteManager} disabled={isManagerPending || !inviteEmail || !inviteName}>
                        {isManagerPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Invite and assign
                    </Button>
                </div>

                <select
                    value={selectedManagerId}
                    onChange={(e) => setSelectedManagerId(e.target.value)}
                    disabled={isManagerPending || managerProfiles.length === 0}
                    className="w-full flex h-10 items-center rounded-md border border-input bg-background px-3 py-2 text-[17px] focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
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
                    Assign existing manager
                </Button>
            </div>

            <div className="space-y-3 pt-2">
                {managerAssignments.length > 0 ? (
                    managerAssignments.map((assignment) => (
                        <div
                            key={assignment.id}
                            className="rounded-md border border-border/60 bg-background px-4 py-3"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[17px] font-medium">
                                        {resolveManagerEmail(assignment.manager)}
                                    </p>
                                    <p className="text-[15px] text-muted-foreground">
                                        {assignment.is_active ? "Active" : "Inactive"} · started {formatAssignmentStartDate(assignment.starts_at, locale)}
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
                                    className="w-full flex h-9 items-center rounded-md border border-input bg-background px-3 py-2 text-[17px] focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">Select target workspace</option>
                                    {accessibleWorkspaces.map((entry) => (
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
                    <p className="text-[17px] text-muted-foreground">No manager assignments found for this workspace.</p>
                )}
            </div>
        </div>
    );
}
