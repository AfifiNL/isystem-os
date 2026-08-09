import { cn } from "@/shared/lib/utils";

interface ProBadgeProps {
    className?: string;
}

export function ProBadge({ className }: ProBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary",
                className,
            )}
        >
            Pro
        </span>
    );
}
