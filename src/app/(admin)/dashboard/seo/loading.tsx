import { AiOperationPendingCard, PremiumPageLoading, PremiumPanelSkeleton } from "@/shared/ui/loading";

export default function Loading() {
    return (
        <PremiumPageLoading
            eyebrow="SEO Control Center"
            title="Loading strategist and specialist signals"
            description="Preparing graph intelligence, recommendation scoring, and persisted SEO runs with a research-grade loading layer."
            tone="seo"
            metrics={4}
        >
            <AiOperationPendingCard
                title="Building the SEO graph"
                description="Collecting inventory, analytics, and recommendation history for strategist-ready decision making."
                steps={["Inventory map", "Signal scoring", "Execution history"]}
                activeStep={1}
                tone="seo"
            />
            <PremiumPanelSkeleton lines={6} />
        </PremiumPageLoading>
    );
}

