"use client";

import { useActionState, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
    AlertTriangle,
    Ban,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    ExternalLink,
    FileText,
    ListFilter,
    MailCheck,
    Megaphone,
    Radar,
    Search,
    Send,
    Upload,
    UserCheck,
    Users,
} from "lucide-react";
import {
    cancelOutreachAccountScheduleAction,
    cancelOutreachCampaignScheduleAction,
    createOutreachCampaignAction,
    executeOutreachAccountSequenceAction,
    bulkApproveOutreachAccountsAction,
    bulkGenerateSequencesAction,
    bulkQueueLinkedinEnrichmentAction,
    bulkScheduleMessagesAction,
    importOutreachCsvAction,
    queueOutreachCampaignDiscoveryAction,
    reviewOutreachAccountAction,
    type OutreachActionState,
} from "@/features/outreach/service";
import type { OutreachDashboardData, OutreachProspectReviewItem } from "@/features/outreach/types";
import { LinkedInEnrichmentPanel } from "./linkedin-enrichment-panel";
import {
    DashboardAppWorkbench,
    AppMetricStrip,
    AppMetric,
    AppFeedbackLoop,
} from "@/features/admin/ui/app-workbench";

const initialState: OutreachActionState = { error: null, success: false };
const views = ["review", "selected", "queue", "events"] as const;
type ViewMode = typeof views[number];
const tablePageSize = 100;

function formatDate(value: string | null | undefined) {
    if (!value) return "Not scheduled";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not scheduled";
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function statusClass(value: string) {
    if (["approved", "selected", "sent", "delivered", "opened", "clicked", "replied", "scheduled", "active"].includes(value)) {
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    }
    if (["rejected", "failed", "bounced", "complained", "cancelled", "stopped"].includes(value)) {
        return "border-destructive/30 bg-destructive/10 text-destructive";
    }
    if (["needs_changes", "paused", "draft", "discovering", "reviewing"].includes(value)) {
        return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    }
    return "border-border bg-muted/50 text-muted-foreground";
}

function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
    return (
        <span className={`inline-flex h-6 items-center rounded-md border px-2 text-[14px] font-semibold uppercase tracking-[0.08em] ${tone ?? "border-border bg-muted/50 text-muted-foreground"}`}>
            {children}
        </span>
    );
}

function EmptyState({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-border/50 bg-background/50 px-4 text-[17px] text-muted-foreground">
            {children}
        </div>
    );
}

function PaginationControls({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, maxPage);
    const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const end = Math.min(total, safePage * pageSize);

    return (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 text-[15px] text-muted-foreground">
            <span>{start}-{end} of {total}</span>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, safePage - 1))}
                    disabled={safePage <= 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    aria-label="Previous page"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-16 text-center">Page {safePage}/{maxPage}</span>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(maxPage, safePage + 1))}
                    disabled={safePage >= maxPage}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    aria-label="Next page"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function CreateCampaignForm({ apifyEnabled = false }: { apifyEnabled?: boolean }) {
    const [state, formAction, pending] = useActionState(createOutreachCampaignAction, initialState);
    return (
        <details className="rounded-md border border-border/50 bg-card">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[17px] font-semibold text-foreground">
                <span className="inline-flex items-center gap-2"><Megaphone className="h-4 w-4" /> Create campaign brief</span>
                <span className="text-[15px] font-normal text-muted-foreground">Open</span>
            </summary>
            <form action={formAction} className="grid min-w-0 gap-3 border-t border-border/50 p-4">
                <input name="name" placeholder="Campaign name" className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-[17px] text-foreground outline-none focus:ring-2 focus:ring-ring" />
                <textarea name="brief" placeholder="Brief: outcome, offer, constraints" className="min-h-20 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[17px] text-foreground outline-none focus:ring-2 focus:ring-ring" />
                <textarea name="icpDescription" placeholder="ICP: account traits, pains, exclusions, buying signals" className="min-h-20 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[17px] text-foreground outline-none focus:ring-2 focus:ring-ring" />
                <div className="grid min-w-0 gap-3 md:grid-cols-3">
                    <textarea name="sectors" placeholder="Sectors" className="min-h-16 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[17px] text-foreground outline-none focus:ring-2 focus:ring-ring" />
                    <textarea name="geographies" placeholder="Geographies" className="min-h-16 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[17px] text-foreground outline-none focus:ring-2 focus:ring-ring" />
                    <textarea name="exclusions" placeholder="Exclusions" className="min-h-16 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[17px] text-foreground outline-none focus:ring-2 focus:ring-ring" />
                </div>
                {apifyEnabled ? (
                    <label className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-[15px] font-medium text-muted-foreground">
                        <input type="checkbox" name="useApifyMaps" className="h-4 w-4 accent-primary" />
                        Apify Maps discovery
                    </label>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                    <p className={`text-[15px] ${state.error ? "text-destructive" : state.success ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                        {state.error ?? (state.success ? "Campaign created and discovery queued." : "Creates search jobs from the campaign brief.")}
                    </p>
                    <button disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[17px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
                        <Megaphone className="h-4 w-4" />
                        {pending ? "Creating" : "Create"}
                    </button>
                </div>
            </form>
        </details>
    );
}

const standardFields = [
    { key: "companyName", label: "Company Name", fallback: ["company", "company_name", "account", "account_name", "organization", "organisation", "business_name", "name"] },
    { key: "websiteUrl", label: "Website URL", fallback: ["website_url", "website", "url", "company_url", "source_url"] },
    { key: "domain", label: "Domain", fallback: ["domain", "company_domain"] },
    { key: "email", label: "Contact Email", fallback: ["email", "email_address", "contact_email"] },
    { key: "fullName", label: "Contact Full Name", fallback: ["contact_name", "full_name", "person", "person_name", "contact"] },
    { key: "roleTitle", label: "Job Title", fallback: ["role_title", "title", "job_title", "position", "role"] },
    { key: "country", label: "Country", fallback: ["country", "location"] },
    { key: "sector", label: "Sector / Industry", fallback: ["sector", "industry"] },
    { key: "fitScore", label: "Fit Score", fallback: ["fit_score", "score"] },
    { key: "fitSummary", label: "Fit Summary", fallback: ["fit_summary", "notes", "summary", "description"] },
    { key: "whyNowTrigger", label: "Why Now Trigger", fallback: ["why_now", "why_now_trigger", "trigger"] },
    { key: "sourceUrl", label: "Source URL", fallback: ["source_url", "linkedin_url", "profile_url"] },
];

function parseCsvLineClient(line: string): string[] {
    const cells: string[] = [];
    let quoted = false;
    let current = "";
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === "\"" && line[i + 1] === "\"") {
            current += "\"";
            i++;
            continue;
        }
        if (char === "\"") {
            quoted = !quoted;
            continue;
        }
        if (char === "," && !quoted) {
            cells.push(current.trim());
            current = "";
            continue;
        }
        current += char;
    }
    cells.push(current.trim());
    return cells;
}

function parseCsvClient(text: string) {
    const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length < 2) return { headers: [], rows: [] };
    const rawHeaders = parseCsvLineClient(lines[0] || "");
    const rows = lines.slice(1, 100).map((line) => {
        const cells = parseCsvLineClient(line);
        const row: Record<string, string> = {};
        rawHeaders.forEach((header, index) => {
            if (!header) return;
            row[header] = cells[index]?.trim() ?? "";
        });
        return row;
    }).filter((row) => Object.values(row).some(Boolean));
    return { headers: rawHeaders, rows };
}

function autoMapHeaders(headers: string[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const field of standardFields) {
        const match = headers.find(h => {
            const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, "_");
            return field.fallback.includes(normalized) || field.fallback.includes(h.toLowerCase());
        });
        if (match) {
            map[field.key] = match;
        }
    }
    return map;
}

function CsvImportForm({ campaigns }: { campaigns: OutreachDashboardData["campaigns"] }) {
    const [state, formAction, pending] = useActionState(importOutreachCsvAction, initialState);
    const [fileName, setFileName] = useState<string>("");
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [step, setStep] = useState<1 | 2>(1);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            setFileName("");
            setHeaders([]);
            setRows([]);
            setMapping({});
            setStep(1);
            return;
        }
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = (event.target?.result as string) || "";
            const { headers: parsedHeaders, rows: parsedRows } = parseCsvClient(text);
            setHeaders(parsedHeaders);
            setRows(parsedRows);
            const initialMap = autoMapHeaders(parsedHeaders);
            setMapping(initialMap);
            if (parsedHeaders.length > 0) {
                setStep(2);
            }
        };
        reader.readAsText(file);
    };

    const firstCsvValueClient = (row: Record<string, string>, keys: string[]) => {
        for (const key of keys) {
            if (row[key]) return row[key];
        }
        return null;
    };

    const duplicateCount = useMemo(() => {
        const domains = new Set<string>();
        let dupes = 0;
        rows.forEach(r => {
            const emailCol = mapping.email ? r[mapping.email] : firstCsvValueClient(r, ["email", "email_address", "contact_email"]);
            const urlCol = mapping.websiteUrl ? r[mapping.websiteUrl] : firstCsvValueClient(r, ["website_url", "website", "url", "company_url", "source_url"]);
            const explicitDomain = mapping.domain ? r[mapping.domain] : firstCsvValueClient(r, ["domain", "company_domain"]);

            let dom = explicitDomain || "";
            if (!dom && urlCol) {
                try {
                    const cleanUrl = urlCol.startsWith("http") ? urlCol : `https://${urlCol}`;
                    dom = new URL(cleanUrl).hostname.replace(/^www\./i, "");
                } catch {}
            }
            if (!dom && emailCol && emailCol.includes("@")) {
                dom = emailCol.split("@")[1] || "";
            }
            if (dom) {
                dom = dom.trim().toLowerCase();
                if (domains.has(dom)) {
                    dupes++;
                } else {
                    domains.add(dom);
                }
            }
        });
        return dupes;
    }, [rows, mapping]);

    const resetForm = () => {
        setFileName("");
        setHeaders([]);
        setRows([]);
        setMapping({});
        setStep(1);
    };

    useEffect(() => {
        if (state.success) {
            resetForm();
        }
    }, [state.success]);

    return (
        <details className="rounded-lg border border-border/50 bg-card" open={step === 2}>
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[17px] font-semibold text-foreground">
                <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /> Import CSV</span>
                <span className="text-[15px] font-normal text-muted-foreground">{step === 2 ? "Configure mappings" : "Open"}</span>
            </summary>
            <form action={formAction} className="grid min-w-0 gap-3 border-t border-border/50 p-4">
                <select
                    name="campaignId"
                    disabled={campaigns.length === 0}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-[17px] text-foreground outline-none focus:border-cyan-300 disabled:opacity-50 overflow-hidden text-ellipsis"
                    defaultValue={campaigns[0]?.id ?? ""}
                >
                    {campaigns.length === 0 ? <option value="">Create a campaign first</option> : null}
                    {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                    ))}
                </select>

                <div className={step === 1 ? "block" : "hidden"}>
                    <input
                        type="file"
                        name="csvFile"
                        accept=".csv,text/csv"
                        disabled={campaigns.length === 0}
                        onChange={handleFileChange}
                        className="block w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[17px] text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-primary text-primary-foreground file:px-3 file:py-1.5 file:text-[17px] file:font-semibold disabled:opacity-50"
                    />
                </div>

                {step === 2 && (
                    <div className="grid gap-3 rounded border border-border/50 bg-card p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[15px] font-semibold text-primary truncate max-w-[200px]" title={fileName}>
                                {fileName} ({rows.length} preview rows)
                            </span>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="text-[15px] text-muted-foreground hover:text-foreground underline"
                            >
                                Change file
                            </button>
                        </div>

                        <div className="text-[14px] text-muted-foreground leading-relaxed">
                            Map standard fields to CSV columns. We have auto-matched fields where possible.
                        </div>

                        <div className="max-h-52 overflow-y-auto border border-border/50 rounded bg-background/50 p-2 grid gap-2">
                            {standardFields.map((field) => (
                                <div key={field.key} className="grid grid-cols-[100px_1fr] items-center gap-2 text-[15px]">
                                    <label className="font-medium text-foreground/90 truncate" title={field.label}>
                                        {field.label}
                                    </label>
                                    <select
                                        value={mapping[field.key] ?? ""}
                                        onChange={(e) => {
                                            setMapping({
                                                ...mapping,
                                                [field.key]: e.target.value,
                                            });
                                        }}
                                        className="h-7 w-full min-w-0 rounded border border-input bg-card px-2 text-[15px] text-foreground outline-none focus:border-cyan-300 overflow-hidden text-ellipsis"
                                    >
                                        <option value="">(Skip / Auto-detect)</option>
                                        {headers.map((h) => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>

                        {duplicateCount > 0 && (
                            <div className="flex items-center gap-1.5 rounded border border-amber-500/20 bg-amber-500/10 p-2 text-[14px] text-amber-200">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                <span>Detected {duplicateCount} duplicate domain(s) in preview list.</span>
                            </div>
                        )}

                        <div className="border-t border-border/50 pt-2">
                            <div className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                Data Preview (Row 1)
                            </div>
                            <div className="max-h-24 overflow-auto rounded bg-background p-2 text-[14px] font-mono text-muted-foreground space-y-1">
                                {rows[0] ? (
                                    standardFields.map((field) => {
                                        const mappedHeader = mapping[field.key];
                                        const previewVal = mappedHeader ? rows[0]?.[mappedHeader] : firstCsvValueClient(rows[0] || {}, field.fallback);
                                        return previewVal ? (
                                            <div key={field.key} className="truncate">
                                                <span className="text-muted-foreground">{field.label}:</span> {previewVal}
                                            </div>
                                        ) : null;
                                    })
                                ) : (
                                    <span className="italic">No preview rows available</span>
                                )}
                            </div>
                        </div>

                        <input type="hidden" name="columnMapping" value={JSON.stringify(mapping)} />
                    </div>
                )}

                <label className="inline-flex w-fit items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-[15px] font-medium text-slate-200">
                    <input type="checkbox" name="manualWarranty" className="h-4 w-4 accent-primary" />
                    Manual warranty
                </label>
                <div className="flex items-center justify-between gap-3">
                    <p className={`text-[15px] ${state.error ? "text-rose-300" : state.success ? "text-emerald-300" : "text-muted-foreground"}`}>
                        {state.error ?? (state.success ? "CSV import queued." : "Ready.")}
                    </p>
                    <button disabled={pending || campaigns.length === 0} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 text-[17px] font-semibold text-slate-950 hover:bg-primary/90 disabled:opacity-60">
                        <Upload className="h-4 w-4" />
                        {pending ? "Queueing" : "Import"}
                    </button>
                </div>
            </form>
        </details>
    );
}

type ReviewStatusInput = "approved" | "rejected" | "needs_changes";

function ReviewButtons({ id }: { id: string }) {
    const [state, formAction, pending] = useActionState(reviewOutreachAccountAction, initialState);
    const [reviewStatus, setReviewStatus] = useState<ReviewStatusInput>("approved");
    return (
        <form action={formAction} className="grid min-w-56 gap-2">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={reviewStatus} />
            <input name="note" placeholder="Review note" className="h-8 min-w-0 rounded-md border border-input bg-card px-2 text-[15px] text-slate-100 outline-none focus:border-cyan-300" />
            <div className="flex flex-wrap gap-1">
                <button type="submit" name="reviewStatus" value="approved" disabled={pending} onPointerDown={() => setReviewStatus("approved")} onFocus={() => setReviewStatus("approved")} className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-400/30 px-2 text-[15px] font-semibold text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-60">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </button>
                <button type="submit" name="reviewStatus" value="rejected" disabled={pending} onPointerDown={() => setReviewStatus("rejected")} onFocus={() => setReviewStatus("rejected")} className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-400/30 px-2 text-[15px] font-semibold text-rose-200 hover:bg-rose-400/10 disabled:opacity-60">
                    <AlertTriangle className="h-3.5 w-3.5" /> Reject
                </button>
                <button type="submit" name="reviewStatus" value="needs_changes" disabled={pending} onPointerDown={() => setReviewStatus("needs_changes")} onFocus={() => setReviewStatus("needs_changes")} className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-400/30 px-2 text-[15px] font-semibold text-amber-200 hover:bg-amber-400/10 disabled:opacity-60">
                    <Clock3 className="h-3.5 w-3.5" /> Needs work
                </button>
            </div>
            {state.error ? <p className="text-[15px] leading-5 text-rose-300">{state.error}</p> : null}
            {state.success ? <p className="text-[15px] leading-5 text-emerald-300">Saved.</p> : null}
        </form>
    );
}

function ProspectActions({ account }: { account: OutreachProspectReviewItem }) {
    const [state, formAction, pending] = useActionState(executeOutreachAccountSequenceAction, initialState);
    const [cancelState, cancelFormAction, cancelPending] = useActionState(cancelOutreachAccountScheduleAction, initialState);
    const disabled = pending || account.draftMessageCount === 0 || account.scheduledMessageCount > 0;
    return (
        <div className="grid min-w-36 gap-2">
            <form action={formAction}>
                <input type="hidden" name="accountId" value={account.id} />
                <button disabled={disabled} className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md bg-emerald-300 px-3 text-[15px] font-semibold text-slate-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60">
                    <Send className="h-3.5 w-3.5" />
                    {pending ? "Running" : account.scheduledMessageCount > 0 ? "Scheduled" : "Execute"}
                </button>
            </form>
            {account.scheduledMessageCount > 0 ? (
                <form action={cancelFormAction}>
                    <input type="hidden" name="accountId" value={account.id} />
                    <button disabled={cancelPending} className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-rose-400/30 px-3 text-[15px] font-semibold text-rose-200 hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-60">
                        <Ban className="h-3.5 w-3.5" />
                        {cancelPending ? "Cancelling" : "Cancel"}
                    </button>
                </form>
            ) : null}
            {state.error ? <p className="text-[15px] leading-5 text-rose-300">{state.error}</p> : null}
            {state.success ? <p className="text-[15px] leading-5 text-emerald-300">Executed.</p> : null}
            {cancelState.error ? <p className="text-[15px] leading-5 text-rose-300">{cancelState.error}</p> : null}
            {cancelState.success ? <p className="text-[15px] leading-5 text-emerald-300">Cancelled.</p> : null}
        </div>
    );
}

function QueueDiscoveryButton({ campaignId, apifyEnabled = false }: { campaignId: string; apifyEnabled?: boolean }) {
    const [state, formAction, pending] = useActionState(queueOutreachCampaignDiscoveryAction, initialState);
    return (
        <form action={formAction} className="grid gap-1">
            <input type="hidden" name="campaignId" value={campaignId} />
            {apifyEnabled ? (
                <label className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted-foreground">
                    <input type="checkbox" name="useApifyMaps" className="h-3.5 w-3.5 accent-primary" />
                    Apify Maps
                </label>
            ) : null}
            <button disabled={pending} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-primary/30 px-2 text-[15px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-60">
                <Radar className="h-3.5 w-3.5" />
                {pending ? "Queueing" : "Discover"}
            </button>
            {state.error ? <span className="text-[15px] text-rose-300">{state.error}</span> : null}
            {state.success ? <span className="text-[15px] text-emerald-300">Queued</span> : null}
        </form>
    );
}

function CancelCampaignScheduleButton({ campaign }: { campaign: OutreachDashboardData["campaigns"][number] }) {
    const [state, formAction, pending] = useActionState(cancelOutreachCampaignScheduleAction, initialState);
    const disabled = pending || campaign.queuedDispatchJobCount === 0;
    return (
        <form action={formAction} className="grid gap-1">
            <input type="hidden" name="campaignId" value={campaign.id} />
            <button disabled={disabled} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-rose-400/30 px-2 text-[15px] font-semibold text-rose-200 hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-60">
                <Ban className="h-3.5 w-3.5" />
                {pending ? "Cancelling" : "Cancel"}
            </button>
            {state.error ? <span className="text-[15px] text-rose-300">{state.error}</span> : null}
            {state.success ? <span className="text-[15px] text-emerald-300">Cancelled</span> : null}
        </form>
    );
}

function CampaignRail({
    campaigns,
    activeCampaignId,
    onSelect,
}: {
    campaigns: OutreachDashboardData["campaigns"];
    activeCampaignId: string;
    onSelect: (id: string) => void;
}) {
    return (
        <aside className="min-h-0 rounded-lg border border-border/50 bg-card">
            <div className="flex h-11 items-center justify-between border-b border-border/50 px-3">
                <h2 className="text-[15px] font-semibold uppercase tracking-[0.14em] text-foreground/90">Campaigns</h2>
                <Badge>{campaigns.length}</Badge>
            </div>
            <div className="max-h-[42rem] overflow-y-auto">
                {campaigns.map((campaign) => (
                    <button
                        key={campaign.id}
                        onClick={() => onSelect(campaign.id)}
                        className={`grid w-full gap-2 border-b border-border/40 px-3 py-3 text-left hover:bg-background/80 ${activeCampaignId === campaign.id ? "bg-primary/10" : ""}`}
                    >
                        <div className="flex min-w-0 items-center justify-between gap-2">
                            <span className="truncate text-[17px] font-semibold text-foreground">{campaign.name}</span>
                            <Badge tone={statusClass(campaign.status)}>{campaign.status}</Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-[14px] text-muted-foreground">
                            <span>{campaign.accountCount} acct</span>
                            <span>{campaign.contactCount} ctc</span>
                            <span>{campaign.scheduledMessageCount} sch</span>
                            <span>{campaign.sentMessageCount} sent</span>
                        </div>
                    </button>
                ))}
                {campaigns.length === 0 ? <div className="p-4 text-[17px] text-muted-foreground">No campaigns yet.</div> : null}
            </div>
        </aside>
    );
}

function CampaignOps({ campaign, apifyEnabled = false }: { campaign: OutreachDashboardData["campaigns"][number] | null; apifyEnabled?: boolean }) {
    if (!campaign) {
        return (
            <section className="flex min-h-[8.5rem] items-center justify-center rounded-lg border border-dashed border-border/50 bg-background/50 p-6 text-center text-[17px] text-muted-foreground">
                Select a campaign from the rail to view details, or create a new campaign brief.
            </section>
        );
    }
    return (
        <section className="rounded-lg border border-border/50 bg-card">
            <div className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-[21px] font-semibold text-foreground">{campaign.name}</h2>
                        <Badge tone={statusClass(campaign.status)}>{campaign.status}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 max-w-4xl text-[17px] leading-6 text-muted-foreground">{campaign.icp_description}</p>
                    <div className="mt-3 grid gap-2 text-[15px] text-muted-foreground sm:grid-cols-5">
                        <span>{campaign.accountCount} accounts</span>
                        <span>{campaign.contactCount} contacts</span>
                        <span>{campaign.approvedMessageCount} approved</span>
                        <span>{campaign.scheduledMessageCount} scheduled</span>
                        <span>{campaign.queuedDispatchJobCount} queued jobs</span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                    <QueueDiscoveryButton campaignId={campaign.id} apifyEnabled={apifyEnabled} />
                    <CancelCampaignScheduleButton campaign={campaign} />
                </div>
            </div>
        </section>
    );
}

function BulkActionsBar({ accounts, mode }: { accounts: OutreachProspectReviewItem[]; mode: "review" | "selected" }) {
    const ids = useMemo(() => accounts.slice(0, 50).map(a => a.id), [accounts]);
    const idsJson = JSON.stringify(ids);

    const [approveState, approveAction, isApproving] = useActionState(bulkApproveOutreachAccountsAction, initialState);
    const [enrichState, enrichAction, isEnriching] = useActionState(bulkQueueLinkedinEnrichmentAction, initialState);
    const [generateState, generateAction, isGenerating] = useActionState(bulkGenerateSequencesAction, initialState);
    const [scheduleState, scheduleAction, isScheduling] = useActionState(bulkScheduleMessagesAction, initialState);
    const isWorking = isApproving || isEnriching || isGenerating || isScheduling;

    const [isDryRun, setIsDryRun] = useState(true);
    const [isCertifying, setIsCertifying] = useState(false);

    if (ids.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-3 border-b border-border/50 text-[15px]">
            <span className="font-medium text-foreground">Bulk Actions ({ids.length} in view):</span>

            {mode === "review" && (
                <>
                    <form action={approveAction}>
                        <input type="hidden" name="accountIds" value={idsJson} />
                        <button type="submit" disabled={isWorking} className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50">
                            {isApproving ? "Approving..." : "Approve All"}
                        </button>
                    </form>

                    <form action={enrichAction}>
                        <input type="hidden" name="accountIds" value={idsJson} />
                        <input type="hidden" name="enrichmentKind" value="company" />
                        <button type="submit" disabled={isWorking} className="rounded border border-primary/30 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/20 disabled:opacity-50">
                            {isEnriching ? "Enriching..." : "Bulk Enrich (Company)"}
                        </button>
                    </form>
                </>
            )}

            {mode === "selected" && (
                <>
                    <form action={generateAction}>
                        <input type="hidden" name="accountIds" value={idsJson} />
                        <button type="submit" disabled={isWorking} className="rounded border border-primary/30 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/20 disabled:opacity-50">
                            {isGenerating ? "Generating..." : "Generate Sequences"}
                        </button>
                    </form>

                    <form action={scheduleAction} className="flex flex-col gap-2 bg-indigo-500/5 p-3 rounded border border-indigo-500/20">
                        <input type="hidden" name="accountIds" value={idsJson} />
                        <div className="flex items-center gap-4 text-xs">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" name="dryRun" value="true" checked={isDryRun} onChange={e => setIsDryRun(e.target.checked)} className="rounded border-indigo-500/30 text-indigo-500 bg-transparent focus:ring-indigo-500/50" />
                                <span className="text-indigo-400/80">Dry run (preview only)</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" name="certifyManualWarranty" value="true" checked={isCertifying} onChange={e => setIsCertifying(e.target.checked)} className="rounded border-indigo-500/30 text-indigo-500 bg-transparent focus:ring-indigo-500/50" />
                                <span className="text-indigo-400/80">Certify manual warranty</span>
                            </label>
                        </div>
                        <button type="submit" disabled={isWorking} className="rounded border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-50 text-sm font-medium self-start">
                            {isScheduling ? "Scheduling..." : isDryRun ? "Preview Schedule" : "Schedule All"}
                        </button>
                    </form>
                </>
            )}

            {(approveState.error || enrichState.error || generateState.error || scheduleState.error) && (
                <span className="text-destructive font-medium ml-2">Error: {approveState.error || enrichState.error || generateState.error || scheduleState.error}</span>
            )}
        </div>
    );
}

function ProspectsTable({ accounts, mode }: { accounts: OutreachProspectReviewItem[]; mode: "review" | "selected" }) {
    const [page, setPage] = useState(1);
    useEffect(() => setPage(1), [accounts, mode]);
    const maxPage = Math.max(1, Math.ceil(accounts.length / tablePageSize));
    const safePage = Math.min(page, maxPage);
    const visibleAccounts = useMemo(() => {
        const start = (safePage - 1) * tablePageSize;
        return accounts.slice(start, start + tablePageSize);
    }, [accounts, safePage]);

    if (accounts.length === 0) return <EmptyState>{mode === "review" ? "No pending prospects match this view." : "No selected prospects match this view."}</EmptyState>;
    return (
        <div className="overflow-hidden rounded-lg border border-border/50 bg-card">
            <BulkActionsBar accounts={accounts} mode={mode} />
            <PaginationControls page={safePage} pageSize={tablePageSize} total={accounts.length} onPageChange={setPage} />
            <div className="max-h-[42rem] overflow-auto">
                <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-left text-[17px]">
                    <thead className="sticky top-0 z-10 bg-card text-[14px] uppercase tracking-[0.12em] text-muted-foreground">
                        <tr>
                            <th className="border-b border-border/50 px-3 py-2 font-semibold">Prospect</th>
                            <th className="border-b border-border/50 px-3 py-2 font-semibold">Campaign</th>
                            <th className="border-b border-border/50 px-3 py-2 font-semibold">Fit</th>
                            <th className="border-b border-border/50 px-3 py-2 font-semibold">Evidence</th>
                            <th className="border-b border-border/50 px-3 py-2 font-semibold">Sequence</th>
                            <th className="border-b border-border/50 px-3 py-2 font-semibold">Updated</th>
                            <th className="border-b border-border/50 px-3 py-2 font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleAccounts.map((account) => (
                            <tr key={account.id} className="hover:bg-background/50">
                                <td className="border-b border-border/40 px-3 py-3 align-top">
                                    <div className="max-w-sm">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="truncate font-semibold text-foreground">{account.name}</span>
                                            <Badge tone={statusClass(account.stage)}>{account.stage}</Badge>
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 text-[15px] text-muted-foreground">
                                            <span className="truncate">{account.domain ?? "No domain"}</span>
                                            {account.website_url ? (
                                                <a href={account.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:text-primary">
                                                    <ExternalLink className="h-3 w-3" /> Open
                                                </a>
                                            ) : null}
                                        </div>
                                        <p className="mt-2 line-clamp-2 text-[15px] leading-5 text-muted-foreground">{account.fit_summary ?? account.why_now_trigger ?? "Needs enrichment."}</p>
                                    </div>
                                </td>
                                <td className="border-b border-border/40 px-3 py-3 align-top text-[15px] text-muted-foreground">{account.campaign_name ?? "Unassigned"}</td>
                                <td className="border-b border-border/40 px-3 py-3 align-top">
                                    <span className="text-[17px] font-semibold text-foreground">{Math.round(account.fit_score)}</span>
                                </td>
                                <td className="border-b border-border/40 px-3 py-3 align-top text-[15px] text-muted-foreground">
                                    <div className="flex gap-3">
                                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {account.contactCount}</span>
                                        <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {account.documentCount}</span>
                                    </div>
                                </td>
                                <td className="border-b border-border/40 px-3 py-3 align-top text-[15px] text-muted-foreground">
                                    <div className="grid grid-cols-3 gap-1">
                                        <span>{account.draftMessageCount} draft</span>
                                        <span>{account.sentMessageCount} sent</span>
                                        <span>{account.scheduledMessageCount} sch</span>
                                    </div>
                                </td>
                                <td className="border-b border-border/40 px-3 py-3 align-top text-[15px] text-muted-foreground">{formatDate(account.updated_at)}</td>
                                <td className="border-b border-border/40 px-3 py-3 align-top">
                                    {mode === "review" ? <ReviewButtons id={account.id} /> : <ProspectActions account={account} />}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function QueueTable({ messages }: { messages: OutreachDashboardData["pendingMessages"] }) {
    const [page, setPage] = useState(1);
    useEffect(() => setPage(1), [messages]);
    const maxPage = Math.max(1, Math.ceil(messages.length / tablePageSize));
    const safePage = Math.min(page, maxPage);
    const visibleMessages = useMemo(() => {
        const start = (safePage - 1) * tablePageSize;
        return messages.slice(start, start + tablePageSize);
    }, [messages, safePage]);

    if (messages.length === 0) return <EmptyState>No queued, scheduled, or draft messages match this view.</EmptyState>;
    return (
        <div className="overflow-hidden rounded-lg border border-border/50 bg-card">
            <PaginationControls page={safePage} pageSize={tablePageSize} total={messages.length} onPageChange={setPage} />
            <div className="max-h-[42rem] overflow-auto">
                <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-[17px]">
                    <thead className="sticky top-0 z-10 bg-card text-[14px] uppercase tracking-[0.12em] text-muted-foreground">
                        <tr>
                            <th className="border-b border-border/50 px-3 py-2 font-semibold">Message</th>
                            <th className="border-b border-border/50 px-3 py-2 font-semibold">Prospect</th>
                            <th className="border-b border-border/50 px-3 py-2 font-semibold">Status</th>
                            <th className="border-b border-border/50 px-3 py-2 font-semibold">Scheduled</th>
                            <th className="border-b border-border/50 px-3 py-2 font-semibold">Risk</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleMessages.map((message) => (
                            <tr key={message.id} className="hover:bg-background/50">
                                <td className="border-b border-border/40 px-3 py-3 align-top">
                                    <div className="max-w-xl">
                                        <p className="truncate font-semibold text-foreground">{message.subject}</p>
                                        <div className="mt-1 line-clamp-2 text-[15px] leading-5 text-muted-foreground" dangerouslySetInnerHTML={{ __html: message.body_html }} />
                                    </div>
                                </td>
                                <td className="border-b border-border/40 px-3 py-3 align-top text-[15px] text-muted-foreground">
                                    <p className="font-medium text-foreground/90">{message.account_name ?? "Unknown account"}</p>
                                    <p>{message.contact_email ?? "No email"}</p>
                                </td>
                                <td className="border-b border-border/40 px-3 py-3 align-top"><Badge tone={statusClass(message.status)}>{message.status}</Badge></td>
                                <td className="border-b border-border/40 px-3 py-3 align-top text-[15px] text-muted-foreground">{formatDate(message.scheduled_for)}</td>
                                <td className="border-b border-border/40 px-3 py-3 align-top text-[17px] font-semibold text-foreground">{Math.round(message.risk_score)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function EventsList({ events }: { events: OutreachDashboardData["recentEvents"] }) {
    if (events.length === 0) return <EmptyState>No outreach events recorded yet.</EmptyState>;
    return (
        <div className="max-h-[42rem] overflow-y-auto rounded-lg border border-border/50 bg-card">
            {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2 text-[17px] last:border-b-0">
                    <span className="font-medium text-slate-200">{event.event_type}</span>
                    <span className="text-[15px] text-muted-foreground">{event.provider ?? "manual"} · {formatDate(event.occurred_at)}</span>
                </div>
            ))}
        </div>
    );
}

export function OutreachControlCenter({ data, apifyEnabled = false }: { data: OutreachDashboardData; apifyEnabled?: boolean }) {
    const [activeCampaignId, setActiveCampaignId] = useState<string>("all");
    const [view, setView] = useState<ViewMode>("review");
    const [query, setQuery] = useState("");

    const activeCampaign = data.campaigns.find((campaign) => campaign.id === activeCampaignId) ?? null;
    const queryText = query.trim().toLowerCase();
    const matchesAccount = useCallback((account: OutreachProspectReviewItem) => {
        const campaignOk = activeCampaignId === "all" || account.campaign_id === activeCampaignId;
        if (!campaignOk) return false;
        if (!queryText) return true;
        return [
            account.name,
            account.domain,
            account.website_url,
            account.campaign_name,
            account.fit_summary,
            account.why_now_trigger,
        ].some((value) => value?.toLowerCase().includes(queryText));
    }, [activeCampaignId, queryText]);

    const reviewAccounts = useMemo(() => data.pendingAccounts.filter(matchesAccount), [data.pendingAccounts, matchesAccount]);
    const selectedAccounts = useMemo(() => data.approvedAccounts.filter(matchesAccount), [data.approvedAccounts, matchesAccount]);
    const queueMessages = useMemo(() => data.pendingMessages.filter((message) => {
        const campaignOk = activeCampaignId === "all" || message.campaign_id === activeCampaignId;
        if (!campaignOk) return false;
        if (!queryText) return true;
        return [message.subject, message.account_name, message.contact_email].some((value) => value?.toLowerCase().includes(queryText));
    }), [data.pendingMessages, activeCampaignId, queryText]);

    if (data.error) {
        return (
            <DashboardAppWorkbench>
                <div className="p-4">
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-[17px] text-destructive">{data.error}</div>
                </div>
            </DashboardAppWorkbench>
        );
    }

    return (
        <DashboardAppWorkbench>
            <div className="flex-1 overflow-y-auto relative">
                <div className="flex min-h-full flex-col gap-4 p-4">
                <AppMetricStrip>
                    <AppMetric icon={Radar} label="Accounts" value={data.stats.accounts} />
                    <AppMetric icon={UserCheck} label="Contacts" value={data.stats.contacts} />
                    <AppMetric icon={MailCheck} label="Sent" value={data.stats.sentMessages} />
                    <AppMetric icon={Send} label="Queues" value={data.stats.queuedDiscoveryJobs + data.stats.queuedDispatchJobs} />
                </AppMetricStrip>

                <AppFeedbackLoop
                    title="Prospect trust loop"
                    description="Research and approval are deliberate gates before a message enters the dispatch queue."
                    stages={[
                        { label: "Accounts", value: data.stats.accounts, detail: "discovered", tone: "info" },
                        { label: "Review", value: reviewAccounts.length, detail: "needs operator decision", tone: reviewAccounts.length > 0 ? "warning" : "success" },
                        { label: "Selected", value: selectedAccounts.length, detail: "approved prospects", tone: "success" },
                        { label: "Queued", value: data.stats.queuedDiscoveryJobs + data.stats.queuedDispatchJobs, detail: "next action", tone: "info" },
                        { label: "Sent", value: data.stats.sentMessages, detail: "message history", tone: "success" },
                    ]}
                    feedbackLabel="Replies, bounces, and enrichment quality change the next segment and cadence; volume alone is not progress."
                />

                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
                    <div className="grid min-w-0 min-h-0 content-start gap-4">
                        <CreateCampaignForm apifyEnabled={apifyEnabled} />
                        <CsvImportForm campaigns={data.campaigns} />
                        <LinkedInEnrichmentPanel
                            campaigns={data.campaigns}
                            pendingAccounts={data.pendingAccounts}
                            approvedAccounts={data.approvedAccounts}
                            apifyEnabled={apifyEnabled}
                        />
                        <CampaignRail campaigns={data.campaigns} activeCampaignId={activeCampaignId} onSelect={setActiveCampaignId} />
                    </div>

                    <section className="grid min-w-0 content-start gap-4">
                        <CampaignOps campaign={activeCampaign} apifyEnabled={apifyEnabled} />

                        <div className="flex flex-col gap-3 rounded-md border border-border/50 bg-card p-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3">
                                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Search prospects, domains, emails, subjects"
                                        className="h-9 min-w-0 flex-1 bg-transparent text-[17px] text-foreground outline-none placeholder:text-muted-foreground"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-2 text-[15px] text-muted-foreground">
                                        <ListFilter className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate max-w-[150px]">
                                            {activeCampaignId === "all" ? "All campaigns" : activeCampaign?.name ?? "Campaign"}
                                        </span>
                                    </span>
                                    <button onClick={() => setActiveCampaignId("all")} className="h-9 shrink-0 rounded-md border border-border bg-background px-3 text-[15px] font-semibold text-foreground hover:bg-muted cursor-pointer">All</button>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {views.map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => setView(item)}
                                        className={`h-9 shrink-0 rounded-md px-3 text-[15px] font-semibold capitalize cursor-pointer transition-colors ${view === item ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground hover:bg-muted"}`}
                                    >
                                        {item === "review" ? `Review (${reviewAccounts.length})` : item === "selected" ? `Selected (${selectedAccounts.length})` : item === "queue" ? `Queue (${queueMessages.length})` : `Events (${data.recentEvents.length})`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {view === "review" ? <ProspectsTable accounts={reviewAccounts} mode="review" /> : null}
                        {view === "selected" ? <ProspectsTable accounts={selectedAccounts} mode="selected" /> : null}
                        {view === "queue" ? <QueueTable messages={queueMessages} /> : null}
                        {view === "events" ? <EventsList events={data.recentEvents} /> : null}
                    </section>
                </div>
                </div>
            </div>
        </DashboardAppWorkbench>
    );
}
