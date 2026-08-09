import { PremiumRouteLoading, PremiumTableSkeleton } from "@/shared/ui/loading";

export default function Loading() {
    return (
        <PremiumRouteLoading
            title="Loading the render queue"
            description="Preparing job state, workspace ownership, and manual fulfillment controls for AI-backed video batch operations."
            tone="orchestrator"
            icon="orchestrator"
        >
            <PremiumTableSkeleton rows={5} columns={4} />
        </PremiumRouteLoading>
    );
}

