import { PremiumPageLoading, PremiumPanelSkeleton } from "@/shared/ui/loading";

export default function ClientsLoading() {
    return (
        <PremiumPageLoading
            eyebrow="Operations"
            title="Loading client management"
            description="Preparing premium client account context, workspace linkage, and SLA continuity views."
            tone="content"
            metrics={4}
        >
            <div className="grid gap-6 xl:grid-cols-2">
                <PremiumPanelSkeleton lines={6} />
                <PremiumPanelSkeleton lines={6} />
                <PremiumPanelSkeleton lines={6} />
                <PremiumPanelSkeleton lines={6} />
            </div>
        </PremiumPageLoading>
    );
}
