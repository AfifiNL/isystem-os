import { PremiumRouteLoading, PremiumTableSkeleton } from "@/shared/ui/loading";

export default function Loading() {
    return (
        <PremiumRouteLoading
            title="Loading the manual post library"
            description="Fetching long-form manual drafts and editorial metadata with a structure that preserves list rhythm and avoids layout shift."
            tone="content"
            icon="content"
        >
            <PremiumTableSkeleton rows={6} columns={2} />
        </PremiumRouteLoading>
    );
}

