import { PremiumPanelSkeleton, PremiumRouteLoading, PremiumTableSkeleton } from "@/shared/ui/loading";

export default function Loading() {
    return (
        <PremiumRouteLoading
            title="Loading the content studio"
            description="Fetching AI drafts, manual entries, asset states, and publishing controls with a layout that mirrors the final editorial workspace."
            tone="content"
            icon="content"
        >
            <div className="space-y-6">
                <PremiumPanelSkeleton lines={3} />
                <PremiumTableSkeleton rows={5} columns={2} />
            </div>
        </PremiumRouteLoading>
    );
}

