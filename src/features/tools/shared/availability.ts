import { notFound } from "next/navigation";

const REVIEWED_TEMPLATE = "isystem-agency";

export function isPublicToolsBrandReady(
    activeTemplate: string,
    _reviewedOverride?: string,
): boolean {
    void _reviewedOverride;
    return activeTemplate === REVIEWED_TEMPLATE;
}

export function requirePublicToolsBrandReady(activeTemplate: string): void {
    if (!isPublicToolsBrandReady(activeTemplate)) {
        notFound();
    }
}
