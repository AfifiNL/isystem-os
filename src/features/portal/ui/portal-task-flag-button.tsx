"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPortalClientFlag } from "@/features/portal/actions/sla-flags-actions";

interface PortalTaskFlagButtonProps {
    scheduleId: string;
    taskName: string;
}

// Minimal client-side flag composer for the partner portal. Two affordances:
// "Add note" (informational, status stays put) and "Flag issue" (flips the
// task to status='issue' and emails the workspace managers). Both go through
// the same server action with different `flagIssue` values.
export function PortalTaskFlagButton({ scheduleId, taskName }: PortalTaskFlagButtonProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [body, setBody] = useState("");
    const [flag, setFlag] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function reset() {
        setBody("");
        setFlag(false);
        setError(null);
    }

    function close() {
        setIsOpen(false);
        reset();
    }

    function submit() {
        if (!body.trim() || isPending) return;
        setError(null);
        startTransition(async () => {
            const result = await addPortalClientFlag(scheduleId, body, flag);
            if (result.error) {
                setError(result.error);
                return;
            }
            setSuccess(flag ? "Flag sent to the workspace team." : "Note added.");
            setTimeout(() => setSuccess(null), 3500);
            close();
            router.refresh();
        });
    }

    if (!isOpen) {
        return (
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                    + Note / Flag
                </button>
                {success ? (
                    <span className="text-[11px] font-medium text-emerald-600">{success}</span>
                ) : null}
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs space-y-2">
            <p className="font-semibold text-slate-700">Note on “{taskName}”</p>
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What happened? What needs the operator's attention?"
                rows={3}
                maxLength={4000}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <label className="flex items-center gap-2 text-[11px] text-slate-700">
                <input
                    type="checkbox"
                    checked={flag}
                    onChange={(e) => setFlag(e.target.checked)}
                    className="h-3.5 w-3.5"
                />
                Flag as an issue (notifies the workspace team and marks the task as blocked)
            </label>
            {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={submit}
                    disabled={!body.trim() || isPending}
                    className="rounded-md bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                    {isPending ? "Sending…" : flag ? "Send flag" : "Add note"}
                </button>
                <button
                    type="button"
                    onClick={close}
                    disabled={isPending}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
