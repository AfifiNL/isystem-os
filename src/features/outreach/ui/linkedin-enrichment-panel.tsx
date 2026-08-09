"use client";

import { useActionState, useEffect, useState, useMemo } from "react";
import { Linkedin, Users, FileText, Loader2, Sparkles, Building, UserCheck } from "lucide-react";
import { queueLinkedinEnrichmentAction, getContactsForAccountAction } from "@/features/outreach/service";
import type { OutreachDashboardData, OutreachProspectReviewItem } from "@/features/outreach/types";

const initialState = { error: null as string | null, success: false };

type Campaign = OutreachDashboardData["campaigns"][number];

interface ContactOption {
    id: string;
    full_name: string | null;
    email: string | null;
    role_title: string | null;
    source_url: string | null;
}

export function LinkedInEnrichmentPanel({
    campaigns,
    pendingAccounts,
    approvedAccounts,
    apifyEnabled = false,
}: {
    campaigns: Campaign[];
    pendingAccounts: OutreachProspectReviewItem[];
    approvedAccounts: OutreachProspectReviewItem[];
    apifyEnabled?: boolean;
}) {
    const [state, formAction, pending] = useActionState(queueLinkedinEnrichmentAction, initialState);

    const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
    const [selectedAccountId, setSelectedAccountId] = useState<string>("");
    const [selectedContactId, setSelectedContactId] = useState<string>("");
    const [enrichmentKind, setEnrichmentKind] = useState<"profile" | "company" | "employees" | "posts">("profile");
    const [targetUrl, setTargetUrl] = useState<string>("");

    const [contacts, setContacts] = useState<ContactOption[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);

    // Combine pending and approved accounts for the selection
    const allAccounts = useMemo(() => {
        return [...pendingAccounts, ...approvedAccounts];
    }, [pendingAccounts, approvedAccounts]);

    // Filter accounts belonging to the selected campaign
    const filteredAccounts = useMemo(() => {
        if (!selectedCampaignId) return [];
        return allAccounts.filter(acc => acc.campaign_id === selectedCampaignId);
    }, [allAccounts, selectedCampaignId]);

    // Set default campaign when campaigns load
    useEffect(() => {
        if (campaigns.length > 0 && !selectedCampaignId) {
            setSelectedCampaignId(campaigns[0].id);
        }
    }, [campaigns, selectedCampaignId]);

    // Set default account when campaign changes
    useEffect(() => {
        if (filteredAccounts.length > 0) {
            setSelectedAccountId(filteredAccounts[0].id);
        } else {
            setSelectedAccountId("");
            setContacts([]);
            setSelectedContactId("");
        }
    }, [filteredAccounts]);

    // Fetch contacts when account changes
    useEffect(() => {
        if (!selectedAccountId) {
            setContacts([]);
            setSelectedContactId("");
            return;
        }

        setLoadingContacts(true);
        getContactsForAccountAction(selectedAccountId)
            .then(data => {
                setContacts(data);
                if (data.length > 0) {
                    setSelectedContactId(data[0].id);
                } else {
                    setSelectedContactId("");
                }
            })
            .catch(() => {
                setContacts([]);
                setSelectedContactId("");
            })
            .finally(() => {
                setLoadingContacts(false);
            });
    }, [selectedAccountId]);

    // Auto-fill target URL based on selected account or contact
    useEffect(() => {
        if (enrichmentKind === "profile" || (enrichmentKind === "posts" && selectedContactId)) {
            const activeContact = contacts.find(c => c.id === selectedContactId);
            if (activeContact?.source_url && activeContact.source_url.includes("linkedin.com")) {
                setTargetUrl(activeContact.source_url);
                return;
            }
        }

        // Default fallback to company website or domain if company-related enrichment is active
        if (enrichmentKind === "company" || enrichmentKind === "employees" || enrichmentKind === "posts") {
            const activeAccount = allAccounts.find(a => a.id === selectedAccountId);
            if (activeAccount?.website_url && activeAccount.website_url.includes("linkedin.com")) {
                setTargetUrl(activeAccount.website_url);
                return;
            }
        }

        setTargetUrl("");
    }, [enrichmentKind, selectedAccountId, selectedContactId, contacts, allAccounts]);

    if (!apifyEnabled) {
        return (
            <details className="group rounded-lg border border-border/50 bg-card p-4">
                <summary className="flex cursor-pointer items-center justify-between text-[15px] font-semibold uppercase tracking-[0.14em] text-muted-foreground outline-none select-none">
                    <span className="flex items-center gap-2">
                        <Linkedin className="h-4 w-4 text-muted-foreground" /> LinkedIn Enrichment
                    </span>
                    <span className="text-slate-600 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-3 text-[15px] leading-5 text-muted-foreground">
                    LinkedIn enrichment requires Apify. Configure <code className="text-primary">APIFY_ENABLED=1</code> and a valid <code className="text-primary">APIFY_API_TOKEN</code> in your environment variables to enable it.
                </div>
            </details>
        );
    }

    return (
        <details className="group rounded-lg border border-border/50 bg-card p-4 open:bg-card">
            <summary className="flex cursor-pointer items-center justify-between text-[15px] font-semibold uppercase tracking-[0.14em] text-foreground/90 outline-none select-none">
                <span className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-primary" /> LinkedIn Enrichment
                </span>
                <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
            </summary>

            <form action={formAction} className="mt-4 grid min-w-0 gap-3">
                {/* Hidden Fields for Server Action */}
                <input type="hidden" name="campaignId" value={selectedCampaignId} />
                <input type="hidden" name="accountId" value={selectedAccountId} />
                <input type="hidden" name="contactId" value={selectedContactId} />
                <input type="hidden" name="enrichmentKind" value={enrichmentKind} />

                {/* Campaign Selection */}
                <div className="grid min-w-0 gap-1">
                    <label className="text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">Campaign</label>
                    <select
                        value={selectedCampaignId}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-2 text-[15px] text-foreground outline-none focus:border-cyan-300 overflow-hidden text-ellipsis"
                    >
                        {campaigns.map((camp) => (
                            <option key={camp.id} value={camp.id}>{camp.name}</option>
                        ))}
                        {campaigns.length === 0 && <option value="">No campaigns available</option>}
                    </select>
                </div>

                {/* Account Selection */}
                <div className="grid min-w-0 gap-1">
                    <label className="text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">Prospect Account</label>
                    <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-2 text-[15px] text-foreground outline-none focus:border-cyan-300 overflow-hidden text-ellipsis"
                    >
                        {filteredAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.domain || "no domain"})</option>
                        ))}
                        {filteredAccounts.length === 0 && <option value="">No accounts in campaign</option>}
                    </select>
                </div>

                {/* Enrichment Type Toggle Tabs */}
                <div className="grid min-w-0 gap-1">
                    <label className="text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">Enrichment Action</label>
                    <div className="grid grid-cols-2 gap-1 rounded-md border border-border/50 bg-card p-1">
                        <button
                            type="button"
                            onClick={() => setEnrichmentKind("profile")}
                            className={`flex h-7 items-center justify-center gap-1.5 rounded-md text-[14px] font-semibold transition-all ${enrichmentKind === "profile" ? "bg-primary text-primary-foreground text-slate-950" : "text-muted-foreground hover:text-slate-200"}`}
                        >
                            <UserCheck className="h-3 w-3" /> Profile
                        </button>
                        <button
                            type="button"
                            onClick={() => setEnrichmentKind("company")}
                            className={`flex h-7 items-center justify-center gap-1.5 rounded-md text-[14px] font-semibold transition-all ${enrichmentKind === "company" ? "bg-primary text-primary-foreground text-slate-950" : "text-muted-foreground hover:text-slate-200"}`}
                        >
                            <Building className="h-3 w-3" /> Company
                        </button>
                        <button
                            type="button"
                            onClick={() => setEnrichmentKind("employees")}
                            className={`flex h-7 items-center justify-center gap-1.5 rounded-md text-[14px] font-semibold transition-all ${enrichmentKind === "employees" ? "bg-primary text-primary-foreground text-slate-950" : "text-muted-foreground hover:text-slate-200"}`}
                        >
                            <Users className="h-3 w-3" /> Employees
                        </button>
                        <button
                            type="button"
                            onClick={() => setEnrichmentKind("posts")}
                            className={`flex h-7 items-center justify-center gap-1.5 rounded-md text-[14px] font-semibold transition-all ${enrichmentKind === "posts" ? "bg-primary text-primary-foreground text-slate-950" : "text-muted-foreground hover:text-slate-200"}`}
                        >
                            <FileText className="h-3 w-3" /> Posts
                        </button>
                    </div>
                </div>

                {/* Contact Selection (if Profile or Posts is selected) */}
                {(enrichmentKind === "profile" || enrichmentKind === "posts") && (
                    <div className="grid min-w-0 gap-1">
                        <div className="flex items-center justify-between">
                            <label className="text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">Target Contact</label>
                            {loadingContacts && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                        </div>
                        <select
                            value={selectedContactId}
                            onChange={(e) => setSelectedContactId(e.target.value)}
                            disabled={loadingContacts}
                            className="w-full h-9 rounded-md border border-input bg-background px-2 text-[15px] text-foreground outline-none focus:border-cyan-300 disabled:opacity-50 overflow-hidden text-ellipsis"
                        >
                            {contacts.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.full_name || "Unnamed"} ({c.email || "no email"})
                                </option>
                            ))}
                            {contacts.length === 0 && !loadingContacts && <option value="">No contacts found</option>}
                        </select>
                    </div>
                )}

                {/* Target URL */}
                <div className="grid min-w-0 gap-1">
                    <label className="text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {enrichmentKind === "profile" ? "LinkedIn Profile URL" : "LinkedIn Company URL"}
                    </label>
                    <input
                        name="targetUrl"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        placeholder={enrichmentKind === "profile" ? "https://linkedin.com/in/username" : "https://linkedin.com/company/name"}
                        required
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-[15px] text-foreground outline-none focus:border-cyan-300 overflow-hidden text-ellipsis"
                    />
                </div>

                {/* Submit Block */}
                <div className="flex items-center justify-between gap-3 mt-1">
                    <p className={`text-[15px] ${state.error ? "text-rose-300" : state.success ? "text-emerald-300" : "text-muted-foreground"}`}>
                        {state.error ?? (state.success ? "Enrichment job queued." : "Runs Apify actor in the background.")}
                    </p>
                    <button
                        type="submit"
                        disabled={pending || !targetUrl}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 text-[15px] font-semibold text-slate-950 hover:bg-primary/90 disabled:opacity-60"
                    >
                        {pending ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Queueing
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-3.5 w-3.5" />
                                Enrich
                            </>
                        )}
                    </button>
                </div>
            </form>
        </details>
    );
}
