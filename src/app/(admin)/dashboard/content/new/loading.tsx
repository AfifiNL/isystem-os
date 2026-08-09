import { PremiumPanelSkeleton, PremiumRouteLoading } from "@/shared/ui/loading";

export default function Loading() {
    return (
        <PremiumRouteLoading
            title="Preparing manual draft creation"
            description="Loading the manual authoring environment with the same premium structure used across AI-assisted content operations."
            tone="content"
            icon="content"
        >
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <PremiumPanelSkeleton lines={9} />
                <PremiumPanelSkeleton lines={8} />
            </div>
        </PremiumRouteLoading>
    );
}

