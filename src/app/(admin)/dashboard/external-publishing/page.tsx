import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { loadExternalPublishingDashboardAction } from "@/features/external-publishing/actions";
import { ExternalPublishingStudio } from "@/features/external-publishing/ui/external-publishing-studio";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "External Publishing Studio",
    description: "Manual external publishing packages with platform copy, evidence, compliance review, and export-ready handoffs.",
};

export default async function ExternalPublishingPage() {
    await requireDashboardModuleAccess("external-publishing");
    const dashboard = await loadExternalPublishingDashboardAction();

    if (!dashboard.success || !dashboard.data) {
        return (
            <div className="flex min-h-full items-center justify-center bg-background p-6 text-foreground">
                <div className="max-w-xl rounded-2xl border border-destructive/30 bg-destructive/10 p-6 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-destructive">External Publishing Studio</p>
                    <h1 className="mt-2 text-2xl font-semibold">Dashboard failed to load</h1>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{dashboard.error}</p>
                </div>
            </div>
        );
    }

    return <ExternalPublishingStudio initialData={dashboard.data} />;
}
