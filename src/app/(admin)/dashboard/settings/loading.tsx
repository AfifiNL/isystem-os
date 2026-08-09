import { PremiumPageLoading } from "@/shared/ui/loading";

export default function SettingsLoading() {
    return (
        <PremiumPageLoading
            eyebrow="Settings"
            title="Loading workspace settings"
            description="Retrieving theme, managers, AI credits, and integration configuration."
            tone="default"
            metrics={3}
            panels={2}
        />
    );
}
