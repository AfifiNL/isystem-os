import { getContentItemById } from "@/features/content-engine/actions";
import { CmsWorkspace } from "@/features/content-engine/ui/cms-workspace";
import { notFound, redirect } from "next/navigation";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
    DashboardAppWorkbench,
    AppCommandBar,
} from "@/features/admin/ui/app-workbench";

interface EditContentPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditContentPage({ params }: EditContentPageProps) {
    await requireDashboardModuleAccess("content");

    const { id } = await params;
    const { data: item, error } = await getContentItemById(id);

    if (error || !item) {
        notFound();
    }

    if (item.metadata?.source === "manual") {
        redirect(`/dashboard/content/manual/${item.id}`);
    }

    const workspaceContext = await resolveWorkspaceContext();

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex flex-1 items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/content" className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-[15px] font-medium text-foreground hover:bg-muted cursor-pointer">
                            <ArrowLeft className="mr-1.5 h-4 w-4" />
                            Back
                        </Link>
                    </div>
                    <div className="text-[15px] text-muted-foreground truncate max-w-xs md:max-w-md">
                        Editing: <span className="text-foreground font-semibold">{item.title}</span>
                    </div>
                </div>
            </AppCommandBar>

            <div className="min-h-0 flex-1 flex flex-col lg:border-t">
                <CmsWorkspace item={item} aiGenerationEnabled={workspaceContext?.productFeatures.aiGeneration ?? false} />
            </div>
        </DashboardAppWorkbench>
    );
}
