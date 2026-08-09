"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { runScanAction } from "../actions";
import { Button } from "@/shared/ui/button";

const initialState = { error: null as string | null, success: false, inserted: null as number | null };

export function ScanTrigger() {
    const [state, formAction, isPending] = useActionState(runScanAction, initialState);

    return (
        <form action={formAction} className="flex flex-col items-start gap-2">
            <Button type="submit" disabled={isPending} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                {isPending ? "Scanning…" : "Run opportunity scan"}
            </Button>
            {state.error && (
                <p className="text-[17px] text-destructive">Scan reported issues: {state.error}</p>
            )}
            {state.success && state.error === null && (
                <p className="text-[17px] text-emerald-600 dark:text-emerald-400">
                    Scan complete. {state.inserted ?? 0} new opportunity
                    {state.inserted === 1 ? "" : "ies"} surfaced.
                </p>
            )}
        </form>
    );
}
