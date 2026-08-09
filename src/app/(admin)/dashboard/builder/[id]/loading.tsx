import { AiOperationPendingCard, PremiumPanelSkeleton, PremiumRouteLoading } from "@/shared/ui/loading";

export default function Loading() {
    return (
        <PremiumRouteLoading
            title="Opening the visual builder"
            description="Loading layout JSON, block guidance, and publish controls before the canvas becomes editable."
            tone="builder"
            icon="builder"
        >
            <AiOperationPendingCard
                title="Hydrating builder canvas"
                description="Reconstructing your latest visual layout and editorial structure for a low-friction editing handoff."
                steps={["Layout data", "Block registry", "Publish controls"]}
                activeStep={1}
                tone="builder"
            />
            <PremiumPanelSkeleton className="min-h-[640px]" lines={8} />
        </PremiumRouteLoading>
    );
}

