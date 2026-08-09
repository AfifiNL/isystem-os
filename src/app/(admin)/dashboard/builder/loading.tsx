import { PremiumPanelSkeleton, PremiumRouteLoading } from "@/shared/ui/loading";

export default function Loading() {
    return (
        <PremiumRouteLoading
            title="Loading the page builder index"
            description="Preparing page inventory, creative presets, and builder controls so navigation into the visual system feels editor-grade and deliberate."
            tone="builder"
            icon="builder"
        >
            <div className="space-y-6">
                <PremiumPanelSkeleton lines={5} />
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    <PremiumPanelSkeleton lines={5} />
                    <PremiumPanelSkeleton lines={5} />
                    <PremiumPanelSkeleton lines={5} />
                </div>
            </div>
        </PremiumRouteLoading>
    );
}

