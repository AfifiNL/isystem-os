import { PremiumPanelSkeleton, PremiumRouteLoading } from "@/shared/ui/loading";

export default function Loading() {
    return (
        <PremiumRouteLoading
            title="Opening the content workspace"
            description="Rebuilding editorial context, generated formats, asset metadata, and publish controls before the CMS becomes interactive."
            tone="content"
            icon="content"
        >
            <div className="grid gap-6 xl:grid-cols-[0.28fr_0.72fr]">
                <PremiumPanelSkeleton className="min-h-[560px]" lines={9} />
                <PremiumPanelSkeleton className="min-h-[560px]" lines={10} />
            </div>
        </PremiumRouteLoading>
    );
}

