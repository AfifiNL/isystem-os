"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { PuckEditor as PuckEditorComponent } from "@/features/builder/puck-editor";

// Client-only wrapper so Server Components can dynamic-import the Puck
// editor without tripping Next 15's "ssr: false is not allowed in Server
// Components" guard. The real PuckEditor pulls in @puckeditor/core, every
// block config, the editor shell, and the live preview — keeping that out
// of the server bundle for /dashboard/builder/[id] is the whole point.
const PuckEditor = dynamic(
    () => import("@/features/builder/puck-editor").then((m) => m.PuckEditor),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-border/40 bg-background/60 text-sm text-muted-foreground">
                Loading editor…
            </div>
        ),
    },
);

export function PuckEditorLazy(props: ComponentProps<typeof PuckEditorComponent>) {
    return <PuckEditor {...props} />;
}
