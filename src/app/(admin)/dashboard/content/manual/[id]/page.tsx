import { notFound } from "next/navigation";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { getContentItemById } from "@/features/content-engine/actions";
import { ManualBlogPostEditor } from "@/features/content-engine/ui/manual-blog-post-editor";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
    DashboardAppWorkbench,
    AppCommandBar,
} from "@/features/admin/ui/app-workbench";

interface ManualContentPageProps {
    params: Promise<{ id: string }>;
}

export default async function ManualContentPage({ params }: ManualContentPageProps) {
    await requireDashboardModuleAccess("content");

    const { id } = await params;
    const { data: item, error } = await getContentItemById(id);

    if (error || !item) {
        notFound();
    }

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

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <ManualBlogPostEditor item={item} />
            </div>
        </DashboardAppWorkbench>
    );
}
