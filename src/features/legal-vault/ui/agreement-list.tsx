"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LegalAgreement, LegalAgreementStatus } from "@/features/legal-vault/types";

interface AgreementListProps {
    initialAgreements: LegalAgreement[];
    initialError: string | null;
}

const STATUS_LABEL: Record<LegalAgreementStatus, string> = {
    draft: "Draft",
    sent: "Sent",
    viewed: "Viewed",
    signed: "Signed",
    void: "Void",
    expired: "Expired",
};

const STATUS_BADGE: Record<LegalAgreementStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    viewed: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    signed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    void: "bg-destructive/15 text-destructive",
    expired: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
};

export function AgreementList({ initialAgreements, initialError }: AgreementListProps) {
    const [filter, setFilter] = useState<LegalAgreementStatus | "all">("all");

    const filtered = useMemo(() => {
        if (filter === "all") return initialAgreements;
        return initialAgreements.filter((a) => a.status === filter);
    }, [initialAgreements, filter]);

    return (
        <section className="flex-1 p-4 space-y-3">
            {initialError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[15px] text-destructive">
                    {initialError}
                </div>
            ) : null}

            <div className="flex flex-wrap gap-1.5 select-none">
                <FilterChip current={filter} value="all" onSelect={setFilter}>All</FilterChip>
                {(Object.keys(STATUS_LABEL) as LegalAgreementStatus[]).map((status) => (
                    <FilterChip key={status} current={filter} value={status} onSelect={setFilter}>
                        {STATUS_LABEL[status]}
                    </FilterChip>
                ))}
            </div>

            {filtered.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/60 bg-background/40 p-8 text-center text-[15px] text-muted-foreground">
                    No agreements match this filter.
                </p>
            ) : (
                <div className="rounded-md border border-border/60 bg-card/40 overflow-hidden shadow-2xs">
                    <ul className="divide-y divide-border/30">
                        {filtered.map((agreement) => (
                            <li key={agreement.id} className="grid grid-cols-12 items-center gap-3 px-3.5 py-2.5 text-[15px]">
                                <div className="col-span-5 min-w-0">
                                    <Link
                                        href={`/dashboard/legal-vault/agreements/${agreement.id}`}
                                        className="font-semibold text-foreground hover:underline truncate block"
                                    >
                                        {agreement.title}
                                    </Link>
                                    <p className="text-[13px] text-muted-foreground truncate">
                                        {agreement.partyName} · {agreement.partyEmail}
                                    </p>
                                </div>
                                <div className="col-span-2">
                                    <span className={`rounded px-1.5 py-0.5 text-[13px] font-semibold uppercase ${STATUS_BADGE[agreement.status]}`}>
                                        {STATUS_LABEL[agreement.status]}
                                    </span>
                                </div>
                                <div className="col-span-2 text-[13px] text-muted-foreground font-mono">
                                    {agreement.effectiveDate ?? "—"}
                                </div>
                                <div className="col-span-3 text-right text-[13px] text-muted-foreground">
                                    {new Date(agreement.createdAt).toLocaleDateString("nl-NL")} {new Date(agreement.createdAt).toLocaleTimeString("nl-NL", { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

function FilterChip<T extends string>({
    current,
    value,
    onSelect,
    children,
}: {
    current: T;
    value: T;
    onSelect: (value: T) => void;
    children: React.ReactNode;
}) {
    const active = current === value;
    return (
        <button
            type="button"
            onClick={() => onSelect(value)}
            className={`rounded-md border px-2.5 py-1 text-[15px] font-medium transition cursor-pointer ${
                active
                    ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                    : "border-border/60 bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
        >
            {children}
        </button>
    );
}
