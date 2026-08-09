import { PremiumRouteLoading, PremiumMetricSkeleton, PremiumPanelSkeleton } from "@/shared/ui/loading";

export default function ClientDetailLoading() {
    return (
        <PremiumRouteLoading
            title="Loading client operations console"
            description="Preparing account linkage, SLA continuity, and client workspace detail."
            tone="content"
            icon="content"
        >
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        <PremiumMetricSkeleton />
                        <PremiumMetricSkeleton />
                        <PremiumMetricSkeleton />
                    </div>
                    <PremiumPanelSkeleton lines={8} />
                </div>
                <div className="space-y-6">
                    <PremiumPanelSkeleton lines={5} />
                    <PremiumPanelSkeleton lines={6} />
                </div>
            </div>
        </PremiumRouteLoading>
    );
}
