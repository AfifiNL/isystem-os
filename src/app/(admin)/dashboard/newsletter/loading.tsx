import { PremiumPageLoading } from "@/shared/ui/loading";

export default function NewsletterLoading() {
    return (
        <PremiumPageLoading
            eyebrow="Newsletter"
            title="Loading newsletter dashboard"
            description="Fetching audiences, templates, campaigns, and dispatch jobs for this workspace."
            tone="content"
            metrics={4}
            panels={2}
        />
    );
}
