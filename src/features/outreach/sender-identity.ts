export function resolveOutreachSenderName(
    workspaceSenderName: string | null | undefined,
    configuredSenderName: string | null | undefined,
): string | null {
    return workspaceSenderName?.trim() || configuredSenderName?.trim() || null;
}
