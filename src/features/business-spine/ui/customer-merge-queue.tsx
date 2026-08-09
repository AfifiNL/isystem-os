"use client";

import { useActionState, useState } from "react";
import type { DuplicateCandidateGroup } from "@/features/business-spine/service";
import { mergeBusinessCustomersAction } from "@/features/business-spine/actions";
import { Button } from "@/shared/ui/button";

export function CustomerMergeQueue({ candidates }: { candidates: DuplicateCandidateGroup[] }) {
    if (candidates.length === 0) {
        return (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                <p className="font-medium text-foreground">No duplicates found</p>
                <p className="mt-1 text-[15px]">Identity resolution queue is clear.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-6">
            {candidates.map((group, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-card p-6 shadow-sm">
                    <h3 className="mb-4 text-[15px] font-semibold text-foreground">{group.reason}</h3>
                    <div className="grid gap-4">
                        {group.customers.map((c1, i) => (
                            group.customers.slice(i + 1).map((c2) => (
                                <MergePairRow key={`${c1.id}-${c2.id}`} c1={c1} c2={c2} />
                            ))
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function MergePairRow({ c1, c2 }: { c1: DuplicateCandidateGroup["customers"][0], c2: DuplicateCandidateGroup["customers"][0] }) {
    const [state, action, isPending] = useActionState(mergeBusinessCustomersAction, { ok: true, message: "" });
    const [targetId, setTargetId] = useState<string>(c1.id);
    const sourceId = targetId === c1.id ? c2.id : c1.id;
    const targetCustomer = targetId === c1.id ? c1 : c2;
    const sourceCustomer = targetId === c1.id ? c2 : c1;

    return (
        <div className="flex flex-col gap-4 rounded-md border border-border/50 bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-1">
                <div className="flex items-center gap-2 text-[14px]">
                    <span className="font-semibold text-foreground">Keep:</span>
                    <select
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                        className="rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        <option value={c1.id}>{c1.displayName} ({c1.id.slice(0, 8)}) - {c1.lifecycleStatus}</option>
                        <option value={c2.id}>{c2.displayName} ({c2.id.slice(0, 8)}) - {c2.lifecycleStatus}</option>
                    </select>
                </div>
                <div className="text-[14px] text-muted-foreground mt-2">
                    <span className="font-semibold text-foreground text-sm">Merge:</span>{" "}
                    {sourceCustomer.displayName} ({sourceCustomer.id.slice(0, 8)}) into {targetCustomer.displayName}
                </div>
                {!state.ok && <p className="text-[13px] font-medium text-destructive mt-1">{state.message}</p>}
                {state.ok && state.message && <p className="text-[13px] font-medium text-emerald-600 mt-1">{state.message}</p>}
            </div>
            <form action={action}>
                <input type="hidden" name="sourceCustomerId" value={sourceId} />
                <input type="hidden" name="targetCustomerId" value={targetId} />
                <Button type="submit" disabled={isPending} variant="secondary" size="sm">
                    {isPending ? "Merging..." : "Merge records"}
                </Button>
            </form>
        </div>
    );
}
