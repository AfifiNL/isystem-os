import type { ReactNode } from "react";
import { getActiveTemplate } from "@/features/templates/actions";

export default async function ToolsLayout({ children }: { children: ReactNode }) {
    const { config } = await getActiveTemplate();
    return <div className={`min-h-[60vh] bg-background ${config.id === "isystem-agency" ? "isystem-tools-surface" : ""}`}>{children}</div>;
}
