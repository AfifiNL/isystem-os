import { ManualBlogPostForm } from "@/features/content-engine/ui/manual-blog-post-form";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
    DashboardAppWorkbench,
    AppCommandBar,
} from "@/features/admin/ui/app-workbench";

export default async function NewContentPage() {
    await requireDashboardModuleAccess("content");

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
                </div>
            </AppCommandBar>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <ManualBlogPostForm />
            </div>
        </DashboardAppWorkbench>
    );
}
