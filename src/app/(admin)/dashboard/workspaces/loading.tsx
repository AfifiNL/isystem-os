import { PremiumPageLoading } from "@/shared/ui/loading";

export default function WorkspacesLoading() {
    return (
        <PremiumPageLoading
            eyebrow="Workspaces"
            title="Loading workspaces"
            description="Retrieving workspace list, memberships, and active template state."
            tone="default"
            metrics={3}
            panels={2}
        />
    );
}
