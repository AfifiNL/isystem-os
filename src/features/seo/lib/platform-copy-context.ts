function collapseWhitespace(value: string) {
    return value
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/[#>*_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function getPlatformCopyContext(workspaceContext: string | null | undefined) {
    return collapseWhitespace(workspaceContext ?? "").slice(0, 6000);
}
