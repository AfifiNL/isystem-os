/**
 * AdSense placeholder. Renders nothing until both NEXT_PUBLIC_ADSENSE_CLIENT
 * and a slot-specific ID are set. This keeps unapproved AdSense surfaces from
 * pushing layout in dev and keeps the component tree stable across
 * environments. Slot IDs are environment-scoped so previews can use a test
 * unit while production uses approved units.
 */

interface AdSlotProps {
    slot: "in_content" | "below_result" | "sidebar";
    label?: string;
    className?: string;
}

const SLOT_ENV_VARS: Record<AdSlotProps["slot"], string> = {
    in_content: "NEXT_PUBLIC_ADSENSE_SLOT_IN_CONTENT",
    below_result: "NEXT_PUBLIC_ADSENSE_SLOT_BELOW_RESULT",
    sidebar: "NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR",
};

export function AdSlot({ slot, label, className }: AdSlotProps) {
    const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
    const slotId = process.env[SLOT_ENV_VARS[slot]];

    if (!client || !slotId) {
        if (process.env.NODE_ENV === "development") {
            return (
                <div
                    aria-hidden
                    className={
                        className ??
                        "my-6 flex h-24 items-center justify-center rounded-md border border-dashed border-muted-foreground/30 text-xs text-muted-foreground"
                    }
                >
                    Ad slot: {label ?? slot} (disabled — set {SLOT_ENV_VARS[slot]} to enable)
                </div>
            );
        }
        return null;
    }

    return (
        <ins
            className={className ?? "adsbygoogle my-6 block"}
            style={{ display: "block" }}
            data-ad-client={client}
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
            aria-label={label ?? "Sponsored"}
        />
    );
}
