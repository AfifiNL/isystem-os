import { PremiumPageLoading } from "@/shared/ui/loading";

export default function MarketMonitorLoading() {
    return (
        <PremiumPageLoading
            eyebrow="Market monitor"
            title="Loading market monitor"
            description="Scanning tracked signals and ingesting the latest monitored sources."
            tone="analytics"
            metrics={3}
            panels={2}
        />
    );
}
