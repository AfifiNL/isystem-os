import { AiOperationPendingCard, PremiumPanelSkeleton, PremiumRouteLoading } from "@/shared/ui/loading";

export default function Loading() {
    return (
        <PremiumRouteLoading
            title="Preparing the AI draft studio"
            description="Loading the research, drafting, and asset-generation workspace so creation begins with confidence instead of abrupt empty states."
            tone="content"
            icon="content"
        >
            <AiOperationPendingCard
                title="Loading generation workflow"
                description="Initializing content inputs, generation presets, and media pipelines for long-running AI drafting tasks."
                steps={["Brief controls", "Research stack", "Asset pipeline"]}
                activeStep={0}
                tone="content"
            />
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <PremiumPanelSkeleton lines={8} />
                <PremiumPanelSkeleton lines={7} />
            </div>
        </PremiumRouteLoading>
    );
}

