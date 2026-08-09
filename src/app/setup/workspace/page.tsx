import { redirect } from "next/navigation";
import { WorkspacesList } from "@/features/admin/ui/workspaces-list";
import { getCurrentUserRole, resolveWorkspaceContext } from "@/shared/lib/workspace/context";

export default async function WorkspaceSetupPage() {
    const roleContext = await getCurrentUserRole();

    if (!roleContext) {
        redirect("/login");
    }

    if (roleContext.role !== "admin") {
        redirect("/dashboard");
    }

    const workspaceContext = await resolveWorkspaceContext();

    if ((workspaceContext?.accessibleWorkspaces.length ?? 0) > 0) {
        redirect("/dashboard");
    }

    return (
        <main className="min-h-screen bg-background px-6 py-10 sm:px-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-8">
                <div className="space-y-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                        Workspace setup
                    </p>
                    <h1 className="text-4xl font-bold tracking-tight text-foreground">
                        Your admin account is ready. Create the first workspace to unlock the dashboard.
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                        You are signed in successfully, but this environment does not have an active workspace yet.
                        Provision the first workspace below and we will send you back into the dashboard flow.
                    </p>
                </div>

                <WorkspacesList
                    workspaces={[]}
                    total={0}
                    page={1}
                    pageSize={25}
                    search=""
                    tiers={[]}
                    isActive="all"
                    tierCounts={{}}
                />
            </div>
        </main>
    );
}
