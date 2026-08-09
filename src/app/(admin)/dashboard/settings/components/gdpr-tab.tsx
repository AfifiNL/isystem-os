"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    AlertTriangle,
    Download,
    FileWarning,
    Plus,
    Save,
    ShieldCheck,
    Trash2,
    UserSearch,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
    createGdprRequest,
    deleteGdprRequest,
    deleteSubjectData,
    exportSubjectData,
    saveGdprSettings,
    updateGdprRequestStatus,
} from "@/features/gdpr/actions";
import type {
    GdprRequestStatus,
    GdprRequestType,
    SubProcessor,
    SubjectDataExport,
    WorkspaceGdprRequest,
    WorkspaceGdprSettings,
} from "@/features/gdpr/types";
import { FilterChip, Pagination, PaginationStatus, useUrlFilters } from "@/shared/ui/list-controls";

const LEGAL_BASIS_OPTIONS = [
    { value: "consent", label: "Consent" },
    { value: "contract", label: "Contract" },
    { value: "legal_obligation", label: "Legal obligation" },
    { value: "vital_interests", label: "Vital interests" },
    { value: "public_task", label: "Public task" },
    { value: "legitimate_interest", label: "Legitimate interest" },
];

const COOKIE_MODE_OPTIONS = [
    { value: "banner", label: "Banner" },
    { value: "preferences_panel", label: "Preferences panel" },
    { value: "essential_only", label: "Essential only" },
    { value: "none", label: "None" },
];

const REGION_OPTIONS = ["EU", "UK", "US", "APAC", "Global"] as const;
const REQUEST_TYPE_OPTIONS: Array<{ value: GdprRequestType; label: string }> = [
    { value: "access", label: "Access" },
    { value: "export", label: "Data export" },
    { value: "portability", label: "Portability" },
    { value: "rectification", label: "Rectification" },
    { value: "restriction", label: "Restriction" },
    { value: "deletion", label: "Erasure" },
];
const REQUEST_STATUS_OPTIONS: Array<{ value: GdprRequestStatus; label: string; tone: string }> = [
    { value: "open", label: "Open", tone: "bg-amber-500/10 text-amber-700" },
    { value: "in_progress", label: "In progress", tone: "bg-blue-500/10 text-blue-700" },
    { value: "completed", label: "Completed", tone: "bg-emerald-500/10 text-emerald-700" },
    { value: "rejected", label: "Rejected", tone: "bg-destructive/10 text-destructive" },
];

interface GdprTabProps {
    initialSettings: WorkspaceGdprSettings;
    requests: WorkspaceGdprRequest[];
    totalRequests: number;
    page: number;
    pageSize: number;
    statuses: GdprRequestStatus[];
    types: GdprRequestType[];
    search: string;
    statusCounts: Record<GdprRequestStatus, number>;
}

export function GdprTab({
    initialSettings,
    requests,
    totalRequests,
    page,
    pageSize,
    statuses,
    types,
    search,
    statusCounts,
}: GdprTabProps) {
    const router = useRouter();
    const { updateParams } = useUrlFilters();
    const [settings, setSettings] = useState<WorkspaceGdprSettings>(initialSettings);
    const [isSaving, startSave] = useTransition();
    const [saveStatus, setSaveStatus] = useState<{ tone: "ok" | "err"; message: string } | null>(null);

    // New request form
    const [newRequestEmail, setNewRequestEmail] = useState("");
    const [newRequestName, setNewRequestName] = useState("");
    const [newRequestType, setNewRequestType] = useState<GdprRequestType>("access");
    const [newRequestNotes, setNewRequestNotes] = useState("");
    const [isCreating, startCreate] = useTransition();

    // Subject tools
    const [subjectEmail, setSubjectEmail] = useState("");
    const [isRunningExport, startExport] = useTransition();
    const [isRunningErase, startErase] = useTransition();
    const [exportResult, setExportResult] = useState<SubjectDataExport | null>(null);
    const [subjectStatus, setSubjectStatus] = useState<{ tone: "ok" | "err"; message: string } | null>(null);

    useEffect(() => setSettings(initialSettings), [initialSettings]);

    const searchDraft = useMemo(() => search, [search]);

    const toggleStatus = (s: GdprRequestStatus) => {
        const next = statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s];
        updateParams({ gdprStatus: next.length ? next.join(",") : null, gdprPage: null });
    };
    const toggleType = (t: GdprRequestType) => {
        const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
        updateParams({ gdprType: next.length ? next.join(",") : null, gdprPage: null });
    };

    const saveSettings = () => {
        setSaveStatus(null);
        startSave(async () => {
            const res = await saveGdprSettings({
                dpo_name: settings.dpo_name,
                dpo_email: settings.dpo_email,
                privacy_policy_url: settings.privacy_policy_url,
                terms_url: settings.terms_url,
                processing_legal_basis: settings.processing_legal_basis,
                analytics_retention_days: settings.analytics_retention_days,
                logs_retention_days: settings.logs_retention_days,
                marketing_retention_days: settings.marketing_retention_days,
                sub_processors: settings.sub_processors,
                data_regions: settings.data_regions,
                consent_required: settings.consent_required,
                cookie_consent_mode: settings.cookie_consent_mode,
                notes: settings.notes,
            });
            if (res.error) {
                setSaveStatus({ tone: "err", message: res.error });
                return;
            }
            setSaveStatus({ tone: "ok", message: "GDPR settings saved." });
            if (res.data) setSettings(res.data);
            router.refresh();
        });
    };

    const addProcessor = () => {
        setSettings((prev) => ({
            ...prev,
            sub_processors: [...prev.sub_processors, { name: "", purpose: "" }],
        }));
    };

    const updateProcessor = (index: number, patch: Partial<SubProcessor>) => {
        setSettings((prev) => ({
            ...prev,
            sub_processors: prev.sub_processors.map((p, i) => (i === index ? { ...p, ...patch } : p)),
        }));
    };

    const removeProcessor = (index: number) => {
        setSettings((prev) => ({
            ...prev,
            sub_processors: prev.sub_processors.filter((_, i) => i !== index),
        }));
    };

    const toggleRegion = (region: string) => {
        setSettings((prev) => ({
            ...prev,
            data_regions: prev.data_regions.includes(region)
                ? prev.data_regions.filter((r) => r !== region)
                : [...prev.data_regions, region],
        }));
    };

    const createRequest = () => {
        setSaveStatus(null);
        startCreate(async () => {
            const res = await createGdprRequest({
                subjectEmail: newRequestEmail,
                subjectName: newRequestName || null,
                requestType: newRequestType,
                notes: newRequestNotes || null,
            });
            if (res.error) {
                setSaveStatus({ tone: "err", message: res.error });
                return;
            }
            setNewRequestEmail("");
            setNewRequestName("");
            setNewRequestNotes("");
            setSaveStatus({ tone: "ok", message: "Data subject request recorded." });
            router.refresh();
        });
    };

    const runExport = () => {
        setSubjectStatus(null);
        setExportResult(null);
        startExport(async () => {
            const res = await exportSubjectData(subjectEmail);
            if (res.error || !res.data) {
                setSubjectStatus({ tone: "err", message: res.error ?? "Export failed." });
                return;
            }
            setExportResult(res.data);
            const json = JSON.stringify(res.data, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `subject-export-${res.data.subjectEmail}-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setSubjectStatus({
                tone: "ok",
                message: `Exported ${res.data.newsletterContacts.length} newsletter + ${res.data.bookingReservations.length} booking records.`,
            });
        });
    };

    const runErase = () => {
        if (!confirm(`Permanently delete data associated with ${subjectEmail}?\n\nNewsletter contacts and booking reservations will be removed. This cannot be undone.`)) return;
        setSubjectStatus(null);
        startErase(async () => {
            const res = await deleteSubjectData(subjectEmail);
            if (res.error) {
                setSubjectStatus({ tone: "err", message: res.error });
                return;
            }
            setSubjectStatus({
                tone: "ok",
                message: `Erased ${res.deleted.newsletterContacts} newsletter + ${res.deleted.bookingReservations} booking records.`,
            });
            router.refresh();
        });
    };

    const totalPages = Math.max(1, Math.ceil(totalRequests / pageSize));

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Settings Panel */}
            <section className="rounded-md border border-border/60 bg-card p-6 shadow-sm space-y-5">
                <header className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Compliance settings</h2>
                </header>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Data Protection Officer name
                        </label>
                        <Input
                            value={settings.dpo_name ?? ""}
                            onChange={(e) => setSettings((s) => ({ ...s, dpo_name: e.target.value }))}
                            placeholder="e.g. Jane Doe"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                            DPO email
                        </label>
                        <Input
                            type="email"
                            value={settings.dpo_email ?? ""}
                            onChange={(e) => setSettings((s) => ({ ...s, dpo_email: e.target.value }))}
                            placeholder="dpo@example.com"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Privacy policy URL
                        </label>
                        <Input
                            value={settings.privacy_policy_url ?? ""}
                            onChange={(e) => setSettings((s) => ({ ...s, privacy_policy_url: e.target.value }))}
                            placeholder="https://example.com/privacy"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Terms of service URL
                        </label>
                        <Input
                            value={settings.terms_url ?? ""}
                            onChange={(e) => setSettings((s) => ({ ...s, terms_url: e.target.value }))}
                            placeholder="https://example.com/terms"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Processing legal basis
                        </label>
                        <select
                            value={settings.processing_legal_basis}
                            onChange={(e) =>
                                setSettings((s) => ({ ...s, processing_legal_basis: e.target.value }))
                            }
                            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]"
                        >
                            {LEGAL_BASIS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Cookie consent mode
                        </label>
                        <select
                            value={settings.cookie_consent_mode}
                            onChange={(e) =>
                                setSettings((s) => ({ ...s, cookie_consent_mode: e.target.value }))
                            }
                            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]"
                        >
                            {COOKIE_MODE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                        <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Analytics retention (days)
                        </label>
                        <Input
                            type="number"
                            min={1}
                            max={3650}
                            value={settings.analytics_retention_days}
                            onChange={(e) =>
                                setSettings((s) => ({
                                    ...s,
                                    analytics_retention_days: Number.parseInt(e.target.value, 10) || 0,
                                }))
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Logs retention (days)
                        </label>
                        <Input
                            type="number"
                            min={1}
                            max={3650}
                            value={settings.logs_retention_days}
                            onChange={(e) =>
                                setSettings((s) => ({
                                    ...s,
                                    logs_retention_days: Number.parseInt(e.target.value, 10) || 0,
                                }))
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Marketing retention (days)
                        </label>
                        <Input
                            type="number"
                            min={1}
                            max={3650}
                            value={settings.marketing_retention_days}
                            onChange={(e) =>
                                setSettings((s) => ({
                                    ...s,
                                    marketing_retention_days: Number.parseInt(e.target.value, 10) || 0,
                                }))
                            }
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Data regions
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {REGION_OPTIONS.map((r) => (
                            <FilterChip
                                key={r}
                                active={settings.data_regions.includes(r)}
                                onClick={() => toggleRegion(r)}
                                label={r}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/40 px-4 py-3">
                    <div>
                        <p className="text-[17px] font-medium text-foreground">Require explicit consent</p>
                        <p className="text-[15px] text-muted-foreground">
                            When on, users must opt in before we process their personal data.
                        </p>
                    </div>
                    <input
                        type="checkbox"
                        checked={settings.consent_required}
                        onChange={(e) => setSettings((s) => ({ ...s, consent_required: e.target.checked }))}
                        className="h-4 w-4 rounded border-input"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Sub-processors ({settings.sub_processors.length})
                        </label>
                        <button
                            type="button"
                            onClick={addProcessor}
                            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[15px] text-muted-foreground hover:text-foreground"
                        >
                            <Plus className="h-3 w-3" />
                            Add processor
                        </button>
                    </div>
                    <Link
                        href="/dashboard/legal-vault/agreements/new?template=dpa-processor-nl"
                        className="inline-flex items-center rounded-md border border-border/60 bg-background px-3 py-2 text-[15px] font-medium text-primary hover:bg-muted"
                    >
                        Create DPA in Legal Vault
                    </Link>
                    <div className="space-y-2">
                        {settings.sub_processors.length === 0 ? (
                            <p className="rounded-md border border-dashed border-border/60 bg-background/40 px-3 py-4 text-center text-[15px] text-muted-foreground">
                                No sub-processors declared. Add vendors that process personal data on your behalf (hosting, analytics, email, etc.).
                            </p>
                        ) : (
                            settings.sub_processors.map((p, i) => (
                                <div
                                    key={i}
                                    className="grid gap-2 rounded-md border border-border/60 bg-background/40 p-3 md:grid-cols-[1fr_1fr_140px_auto]"
                                >
                                    <Input
                                        value={p.name}
                                        onChange={(e) => updateProcessor(i, { name: e.target.value })}
                                        placeholder="Vendor name"
                                    />
                                    <Input
                                        value={p.purpose}
                                        onChange={(e) => updateProcessor(i, { purpose: e.target.value })}
                                        placeholder="Purpose (e.g. email delivery)"
                                    />
                                    <Input
                                        value={p.location ?? ""}
                                        onChange={(e) => updateProcessor(i, { location: e.target.value })}
                                        placeholder="Location"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeProcessor(i)}
                                        className="inline-flex items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 px-2 text-destructive hover:bg-destructive/20"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Internal compliance notes
                    </label>
                    <Textarea
                        value={settings.notes ?? ""}
                        onChange={(e) => setSettings((s) => ({ ...s, notes: e.target.value }))}
                        placeholder="Notes for your records (not shown publicly)"
                        className="min-h-24"
                    />
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                    {saveStatus ? (
                        <p
                            className={`text-[15px] ${
                                saveStatus.tone === "ok"
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-destructive"
                            }`}
                        >
                            {saveStatus.message}
                        </p>
                    ) : (
                        <span className="text-[15px] text-muted-foreground">
                            Last saved {new Date(settings.updated_at).toLocaleString()}
                        </span>
                    )}
                    <Button onClick={saveSettings} disabled={isSaving}>
                        {isSaving ? (
                            <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                                Saving…
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-2">
                                <Save className="h-4 w-4" />
                                Save settings
                            </span>
                        )}
                    </Button>
                </div>
            </section>

            {/* Subject data tools */}
            <section className="rounded-md border border-border/60 bg-card p-6 shadow-sm space-y-4">
                <header className="flex items-center gap-2">
                    <UserSearch className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Subject data tools</h2>
                </header>
                <p className="text-[15px] text-muted-foreground">
                    Look up or erase personal data for a specific data subject email. Export downloads a JSON file
                    with newsletter contacts, booking reservations, and portal records. Erasure deletes all
                    matching rows in the workspace.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        type="email"
                        value={subjectEmail}
                        onChange={(e) => setSubjectEmail(e.target.value)}
                        placeholder="subject@example.com"
                        className="flex-1 min-w-[220px]"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={runExport}
                        disabled={!subjectEmail.trim() || isRunningExport}
                    >
                        {isRunningExport ? "Exporting…" : (
                            <span className="inline-flex items-center gap-2">
                                <Download className="h-4 w-4" />
                                Export
                            </span>
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={runErase}
                        disabled={!subjectEmail.trim() || isRunningErase}
                    >
                        {isRunningErase ? "Erasing…" : (
                            <span className="inline-flex items-center gap-2">
                                <Trash2 className="h-4 w-4" />
                                Erase
                            </span>
                        )}
                    </Button>
                </div>
                {subjectStatus ? (
                    <p
                        className={`text-[15px] ${
                            subjectStatus.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"
                        }`}
                    >
                        {subjectStatus.message}
                    </p>
                ) : null}
                {exportResult ? (
                    <div className="rounded-md border border-border/60 bg-background/40 p-3 text-[15px] text-muted-foreground">
                        <p>
                            Preview — {exportResult.newsletterContacts.length} newsletter, {exportResult.bookingReservations.length} bookings, {exportResult.analyticsEventsCount} analytics events. Full JSON downloaded.
                        </p>
                    </div>
                ) : null}
            </section>

            {/* Requests */}
            <section className="rounded-md border border-border/60 bg-card p-6 shadow-sm space-y-4">
                <header className="flex items-center gap-2">
                    <FileWarning className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Data subject requests</h2>
                </header>

                <div className="grid gap-3 rounded-md border border-border/60 bg-background/40 p-4 md:grid-cols-[1fr_1fr_180px_auto]">
                    <Input
                        type="email"
                        value={newRequestEmail}
                        onChange={(e) => setNewRequestEmail(e.target.value)}
                        placeholder="Subject email"
                    />
                    <Input
                        value={newRequestName}
                        onChange={(e) => setNewRequestName(e.target.value)}
                        placeholder="Subject name (optional)"
                    />
                    <select
                        value={newRequestType}
                        onChange={(e) => setNewRequestType(e.target.value as GdprRequestType)}
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-[17px]"
                    >
                        {REQUEST_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <Button onClick={createRequest} disabled={isCreating || !newRequestEmail.trim()}>
                        {isCreating ? "Saving…" : "Record request"}
                    </Button>
                    <Textarea
                        value={newRequestNotes}
                        onChange={(e) => setNewRequestNotes(e.target.value)}
                        placeholder="Internal notes (optional)"
                        className="md:col-span-4 min-h-16"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[17px] uppercase tracking-wider text-muted-foreground">Status</span>
                    {REQUEST_STATUS_OPTIONS.map((s) => (
                        <FilterChip
                            key={s.value}
                            active={statuses.includes(s.value)}
                            onClick={() => toggleStatus(s.value)}
                            label={
                                <span className="inline-flex items-center gap-1">
                                    {s.label}
                                    <span className="rounded-full bg-black/10 px-1.5 text-[16px] font-semibold">
                                        {statusCounts[s.value] ?? 0}
                                    </span>
                                </span>
                            }
                        />
                    ))}
                    <span className="ml-4 text-[17px] uppercase tracking-wider text-muted-foreground">Type</span>
                    {REQUEST_TYPE_OPTIONS.map((t) => (
                        <FilterChip
                            key={t.value}
                            active={types.includes(t.value)}
                            onClick={() => toggleType(t.value)}
                            label={t.label}
                        />
                    ))}
                    <form action="" className="ml-auto flex items-center gap-2">
                        <Input
                            type="search"
                            defaultValue={searchDraft}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    const v = (e.target as HTMLInputElement).value.trim();
                                    updateParams({ gdprSearch: v || null, gdprPage: null });
                                }
                            }}
                            placeholder="Search email or notes…"
                            className="h-8 w-56"
                        />
                    </form>
                </div>

                <div className="space-y-2">
                    {requests.length === 0 ? (
                        <p className="rounded-md border border-dashed border-border/60 bg-background/40 px-4 py-8 text-center text-[17px] text-muted-foreground">
                            No data subject requests match the current filters.
                        </p>
                    ) : (
                        requests.map((req) => (
                            <RequestRow key={req.id} request={req} />
                        ))
                    )}
                </div>

                <div className="flex items-center justify-between gap-3">
                    <PaginationStatus page={page} pageSize={pageSize} total={totalRequests} />
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onChange={(p) => updateParams({ gdprPage: p === 1 ? null : String(p) })}
                    />
                </div>
            </section>
        </div>
    );
}

function RequestRow({ request }: { request: WorkspaceGdprRequest }) {
    const router = useRouter();
    const [isPending, start] = useTransition();
    const [actionError, setActionError] = useState<string | null>(null);

    const transition = (next: GdprRequestStatus) => {
        setActionError(null);
        start(async () => {
            const res = await updateGdprRequestStatus(request.id, next);
            if (res.error) {
                setActionError(res.error);
                return;
            }
            router.refresh();
        });
    };

    const remove = () => {
        if (!confirm("Delete this request record?")) return;
        setActionError(null);
        start(async () => {
            const res = await deleteGdprRequest(request.id);
            if (res.error) {
                setActionError(res.error);
                return;
            }
            router.refresh();
        });
    };

    const statusMeta = REQUEST_STATUS_OPTIONS.find((o) => o.value === request.status);
    const typeMeta = REQUEST_TYPE_OPTIONS.find((o) => o.value === request.request_type);
    const isOverdue = request.status !== "completed" && request.status !== "rejected" && new Date(request.due_at) < new Date();

    return (
        <article className="rounded-md border border-border/60 bg-background/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[15px]">
                        <span className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider ${statusMeta?.tone ?? "bg-muted"}`}>
                            {statusMeta?.label ?? request.status}
                        </span>
                        <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 uppercase tracking-wider text-muted-foreground">
                            {typeMeta?.label ?? request.request_type}
                        </span>
                        {isOverdue ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
                                <AlertTriangle className="h-3 w-3" />
                                Overdue
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-2 text-[17px] font-medium text-foreground">{request.subject_email}</p>
                    {request.subject_name ? (
                        <p className="text-[15px] text-muted-foreground">{request.subject_name}</p>
                    ) : null}
                    <p className="mt-1 text-[15px] text-muted-foreground">
                        Requested {new Date(request.requested_at).toLocaleDateString()} · Due {new Date(request.due_at).toLocaleDateString()}
                    </p>
                    {request.notes ? (
                        <p className="mt-2 whitespace-pre-wrap text-[15px] text-muted-foreground">{request.notes}</p>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[15px]">
                    {request.status !== "in_progress" ? (
                        <button
                            type="button"
                            onClick={() => transition("in_progress")}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 hover:text-foreground disabled:opacity-50"
                        >
                            Start
                        </button>
                    ) : null}
                    {request.status !== "completed" ? (
                        <button
                            type="button"
                            onClick={() => transition("completed")}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                            Complete
                        </button>
                    ) : null}
                    {request.status !== "rejected" ? (
                        <button
                            type="button"
                            onClick={() => transition("rejected")}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 hover:text-foreground disabled:opacity-50"
                        >
                            Reject
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={remove}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive hover:bg-destructive/20 disabled:opacity-50"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                </div>
            </div>
            {actionError ? (
                <p className="mt-2 text-[15px] text-destructive">{actionError}</p>
            ) : null}
        </article>
    );
}
