import { PremiumPageLoading, PremiumPanelSkeleton } from "@/shared/ui/loading";

export default function Loading() {
    return (
        <PremiumPageLoading
            eyebrow="Analytics dashboard"
            title="Compiling workspace intelligence"
            description="Aggregating traffic, conversion, and CTA signals so analytics-heavy views feel reliable while data is being calculated."
            tone="analytics"
            metrics={4}
        >
            <PremiumPanelSkeleton />
        </PremiumPageLoading>
    );
}

