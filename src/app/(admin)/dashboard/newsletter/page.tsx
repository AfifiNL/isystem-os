import Link from "next/link";
import {
    createCampaignFromContentAction,
    createNewsletterAudienceAction,
    createNewsletterAutomationAction,
    createNewsletterAutomationStepAction,
    createNewsletterCampaignAction,
    createNewsletterTemplateAction,
    deleteNewsletterAudienceAction,
    deleteNewsletterAutomationAction,
    deleteNewsletterCampaignAction,
    deleteNewsletterTemplateAction,
    getNewsletterDashboardDataAction,
    runNewsletterDispatchCycleAction,
    scheduleNewsletterCampaignAction,
    sendNewsletterCampaignNowAction,
    updateNewsletterContactAction,
    unsubscribeNewsletterContactAction,
} from "@/features/newsletter/actions";
import { NewsletterActionForm } from "@/features/newsletter/ui/action-form";
import { DomainStatusCard, deriveDomainFromEmail } from "@/features/newsletter/ui/domain-status-card";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { Send, Users, Workflow, Sparkles, Clock3, UserCircle2 } from "lucide-react";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppMetricStrip,
    AppMetric,
    AppFeedbackLoop,
} from "@/features/admin/ui/app-workbench";

const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "sent", "cancelled", "failed"] as const;
const CONTACT_STATUSES = ["pending", "subscribed", "unsubscribed", "bounced", "complained"] as const;
type ContactStatus = (typeof CONTACT_STATUSES)[number];

const CONTACT_STATUS_TONE: Record<ContactStatus, string> = {
    pending: "bg-amber-500/10 text-amber-600",
    subscribed: "bg-emerald-500/10 text-emerald-600",
    unsubscribed: "bg-slate-500/10 text-slate-500",
    bounced: "bg-red-500/10 text-red-600",
    complained: "bg-red-500/10 text-red-700",
};

function parseList(v: string | string[] | undefined): string[] {
    if (!v) return [];
    const raw = Array.isArray(v) ? v.join(",") : v;
    return raw.split(",").map((x) => x.trim()).filter(Boolean);
}
function parseInt10(v: string | string[] | undefined, fallback: number): number {
    const raw = Array.isArray(v) ? v[0] : v;
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function str(v: string | string[] | undefined): string {
    if (!v) return "";
    return Array.isArray(v) ? (v[0] ?? "") : v;
}

function buildQuery(current: Record<string, string | string[] | undefined>, patch: Record<string, string | null>): string {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(current)) {
        if (v == null) continue;
        const str = Array.isArray(v) ? v.join(",") : v;
        if (str.length > 0) next.set(k, str);
    }
    for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `?${qs}` : "";
}

function PaginationStrip({
    page,
    pageSize,
    total,
    keyPrefix,
    current,
}: {
    page: number;
    pageSize: number;
    total: number;
    keyPrefix: string;
    current: Record<string, string | string[] | undefined>;
}) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (totalPages <= 1 && total <= pageSize) {
        return (
            <p className="mt-3 text-[14px] text-muted-foreground">
                Showing {total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + 1)}–{Math.min(total, page * pageSize)} of {total}
            </p>
        );
    }
    const prevHref = `/dashboard/newsletter${buildQuery(current, { [`${keyPrefix}Page`]: page <= 1 ? null : String(page - 1) })}`;
    const nextHref = `/dashboard/newsletter${buildQuery(current, { [`${keyPrefix}Page`]: page >= totalPages ? null : String(page + 1) })}`;
    const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const last = Math.min(total, page * pageSize);
    return (
        <div className="mt-3 flex items-center justify-between gap-2 text-[14px] text-muted-foreground">
            <span>
                {first}–{last} of {total}
            </span>
            <div className="flex items-center gap-1">
                <Link
                    href={prevHref}
                    aria-disabled={page <= 1}
                    className={`inline-flex h-7 items-center rounded border border-border/60 px-2 hover:text-foreground ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                >
                    Prev
                </Link>
                <span>
                    Page {page} / {totalPages}
                </span>
                <Link
                    href={nextHref}
                    aria-disabled={page >= totalPages}
                    className={`inline-flex h-7 items-center rounded border border-border/60 px-2 hover:text-foreground ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
                >
                    Next
                </Link>
            </div>
        </div>
    );
}

function StatusChips({
    statuses,
    current,
    counts,
}: {
    statuses: string[];
    current: Record<string, string | string[] | undefined>;
    counts: Record<string, number>;
}) {
    return (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="text-[14px] uppercase tracking-wider text-muted-foreground">Status</span>
            {CAMPAIGN_STATUSES.map((status) => {
                const active = statuses.includes(status);
                const nextSet = active ? statuses.filter((s) => s !== status) : [...statuses, status];
                const href = `/dashboard/newsletter${buildQuery(current, {
                    campaignStatus: nextSet.length ? nextSet.join(",") : null,
                    campaignsPage: null,
                })}`;
                return (
                    <Link
                        key={status}
                        href={href}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[14px] font-medium capitalize transition-colors ${
                            active
                                ? "bg-primary text-primary-foreground"
                                : "border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {status}
                        <span className="rounded-full bg-black/10 px-1.5 text-[13px] font-semibold">{counts[status] ?? 0}</span>
                    </Link>
                );
            })}
            {statuses.length > 0 ? (
                <Link
                    href={`/dashboard/newsletter${buildQuery(current, { campaignStatus: null, campaignsPage: null })}`}
                    className="text-[14px] text-muted-foreground hover:text-foreground"
                >
                    Clear
                </Link>
            ) : null}
        </div>
    );
}

function ListSearchForm({
    name,
    defaultValue,
    placeholder,
    preserve,
}: {
    name: string;
    defaultValue: string;
    placeholder: string;
    preserve: Record<string, string | string[] | undefined>;
}) {
    return (
        <form action="/dashboard/newsletter" className="mb-4 flex items-center gap-2">
            {Object.entries(preserve).map(([k, v]) => {
                if (k === name || k === `${name.replace("Search", "")}Page`) return null;
                const str = Array.isArray(v) ? v.join(",") : v;
                if (!str) return null;
                return <input key={k} type="hidden" name={k} value={str} />;
            })}
            <input
                type="search"
                name={name}
                defaultValue={defaultValue}
                placeholder={placeholder}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-[15px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button type="submit" className="h-8 rounded-md border border-border/60 px-2 text-[15px] hover:text-foreground">
                Search
            </button>
        </form>
    );
}

interface NewsletterPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewsletterDashboardPage({ searchParams }: NewsletterPageProps) {
    await requireDashboardModuleAccess("newsletter");
    const params = await searchParams;

    const audiencesPage = Math.max(1, parseInt10(params.audiencesPage, 1));
    const templatesPage = Math.max(1, parseInt10(params.templatesPage, 1));
    const campaignsPage = Math.max(1, parseInt10(params.campaignsPage, 1));
    const automationsPage = Math.max(1, parseInt10(params.automationsPage, 1));
    const contactsPage = Math.max(1, parseInt10(params.contactsPage, 1));
    const pageSize = Math.min(100, Math.max(5, parseInt10(params.pageSize, 20)));

    const audiencesSearch = str(params.audiencesSearch);
    const templatesSearch = str(params.templatesSearch);
    const campaignsSearch = str(params.campaignsSearch);
    const automationsSearch = str(params.automationsSearch);
    const contactsSearch = str(params.contactsSearch);
    const campaignStatuses = parseList(params.campaignStatus).filter((s) =>
        (CAMPAIGN_STATUSES as readonly string[]).includes(s),
    );
    const contactStatuses = parseList(params.contactStatus).filter((s) =>
        (CONTACT_STATUSES as readonly string[]).includes(s),
    );

    const data = await getNewsletterDashboardDataAction({
        audiencesPage,
        audiencesPageSize: pageSize,
        audiencesSearch,
        templatesPage,
        templatesPageSize: pageSize,
        templatesSearch,
        campaignsPage,
        campaignsPageSize: pageSize,
        campaignsSearch,
        campaignsStatuses: campaignStatuses,
        automationsPage,
        automationsPageSize: pageSize,
        automationsSearch,
        contactsPage,
        contactsPageSize: pageSize,
        contactsSearch,
        contactsStatuses: contactStatuses,
    });

    const statCards = [
        { label: "Contacts", value: data.stats.contacts, icon: Users },
        { label: "Campaigns", value: data.stats.campaigns, icon: Send },
        { label: "Automations", value: data.stats.automations, icon: Workflow },
        { label: "Pending jobs", value: data.stats.pendingJobs, icon: Clock3 },
    ];

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex items-center gap-4">
                    <DomainStatusCard
                        domain={deriveDomainFromEmail(
                            process.env.NEWSLETTER_FROM_EMAIL?.trim()?.replace(/^.*<([^>]+)>.*$/, "$1") ?? null,
                        )}
                    />
                    <NewsletterActionForm action={runNewsletterDispatchCycleAction}>
                        <button type="submit" className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-[15px] font-medium text-primary-foreground hover:bg-primary/95 cursor-pointer">
                            Run dispatch cycle
                        </button>
                    </NewsletterActionForm>
                </div>
            </AppCommandBar>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AppMetricStrip>
                    {statCards.map((card) => (
                        <AppMetric key={card.label} icon={card.icon} label={card.label} value={card.value} />
                    ))}
                </AppMetricStrip>

                <AppFeedbackLoop
                    title="Audience retention loop"
                    description="The newsletter surface follows the path from audience state to dispatched communication and response."
                    stages={[
                        { label: "Contacts", value: data.stats.contacts, detail: "audience base", tone: "info" },
                        { label: "Campaigns", value: data.stats.campaigns, detail: "messages designed", tone: "default" },
                        { label: "Automations", value: data.stats.automations, detail: "response paths", tone: "info" },
                        { label: "Pending", value: data.stats.pendingJobs, detail: "dispatch queue", tone: data.stats.pendingJobs > 0 ? "warning" : "success" },
                    ]}
                    feedbackLabel="Delivery, bounce, complaint, and response signals change audience hygiene and the next campaign."
                />

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                    <div className="rounded-md border border-border/60 bg-card p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <h2 className="text-[21px] font-semibold text-foreground">Audiences</h2>
                            <span className="text-[15px] text-muted-foreground">({data.audiencesPage.total})</span>
                        </div>
                        <NewsletterActionForm action={createNewsletterAudienceAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                            <input name="name" placeholder="Audience name" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-[17px]" required />
                            <input name="description" placeholder="Description" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-[17px]" />
                            <label className="inline-flex items-center gap-2 text-[17px] text-muted-foreground">
                                <input type="checkbox" name="isDefault" className="rounded border-input" /> Default
                            </label>
                            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-[17px] font-medium text-primary-foreground">Create audience</button>
                        </NewsletterActionForm>
                        <div className="mt-5">
                            <ListSearchForm name="audiencesSearch" defaultValue={audiencesSearch} placeholder="Search audiences by name or description…" preserve={params} />
                            <div className="space-y-3">
                                {data.audiences.length === 0 ? (
                                    <p className="rounded-md border border-dashed border-border/50 bg-background/40 px-4 py-6 text-center text-[15px] text-muted-foreground">
                                        {audiencesSearch ? "No audiences match the search." : "No audiences yet."}
                                    </p>
                                ) : (
                                    data.audiences.map((audience) => (
                                        <div key={audience.id} className="rounded-md border border-border/50 bg-background px-4 py-3 text-[17px]">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-medium text-foreground">{audience.name}</p>
                                                    <p className="text-muted-foreground">{audience.description || audience.slug}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {audience.is_default ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[13px] font-semibold uppercase text-primary">Default</span> : null}
                                                    <NewsletterActionForm action={deleteNewsletterAudienceAction}>
                                                        <input type="hidden" name="audienceId" value={audience.id} />
                                                        <button type="submit" className="inline-flex h-8 items-center justify-center rounded-md border border-input px-3 text-[15px] font-medium text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50">Delete</button>
                                                    </NewsletterActionForm>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <PaginationStrip
                                page={data.audiencesPage.page}
                                pageSize={data.audiencesPage.pageSize}
                                total={data.audiencesPage.total}
                                keyPrefix="audiences"
                                current={params}
                            />
                        </div>
                    </div>

                    <div className="rounded-md border border-border/60 bg-card p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <h2 className="text-[21px] font-semibold text-foreground">Templates</h2>
                            <span className="text-[15px] text-muted-foreground">({data.templatesPage.total})</span>
                        </div>
                        <NewsletterActionForm action={createNewsletterTemplateAction} className="grid gap-3 md:grid-cols-2">
                            <input name="name" placeholder="Template name" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-[17px]" required />
                            <select name="workflowType" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-[17px]" defaultValue="broadcast">
                                <option value="broadcast">Broadcast</option>
                                <option value="welcome_series">Welcome series</option>
                                <option value="nurture">Nurture</option>
                                <option value="reengagement">Re-engagement</option>
                            </select>
                            <input name="subjectTemplate" placeholder="Subject template" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-[17px] md:col-span-2" required />
                            <input name="preheaderTemplate" placeholder="Preheader template" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-[17px] md:col-span-2" />
                            <textarea name="bodyMarkdownTemplate" placeholder="Body markdown template" className="min-h-32 rounded-md border border-input bg-background px-3 py-2 text-[17px] md:col-span-2" required />
                            <input name="ctaLabel" placeholder="CTA label" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-[17px]" />
                            <input name="ctaUrl" placeholder="CTA URL" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-[17px]" />
                            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-[17px] font-medium text-primary-foreground md:col-span-2">Create template</button>
                        </NewsletterActionForm>
                        <div className="mt-5">
                            <ListSearchForm name="templatesSearch" defaultValue={templatesSearch} placeholder="Search templates by name or workflow…" preserve={params} />
                            <div className="space-y-3">
                                {data.templates.length === 0 ? (
                                    <p className="rounded-md border border-dashed border-border/50 bg-background/40 px-4 py-6 text-center text-[15px] text-muted-foreground">
                                        {templatesSearch ? "No templates match the search." : "No templates yet."}
                                    </p>
                                ) : (
                                    data.templates.map((template) => (
                                        <div key={template.id} className="rounded-md border border-border/50 bg-background px-4 py-3 text-[17px]">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-medium text-foreground">{template.name}</p>
                                                    <p className="text-muted-foreground">{template.workflow_type}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {template.is_system ? (
                                                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[13px] font-semibold uppercase text-emerald-600">System</span>
                                                    ) : (
                                                        <NewsletterActionForm action={deleteNewsletterTemplateAction}>
                                                            <input type="hidden" name="templateId" value={template.id} />
                                                            <button type="submit" className="inline-flex h-8 items-center justify-center rounded-md border border-input px-3 text-[15px] font-medium text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50">Delete</button>
                                                        </NewsletterActionForm>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <PaginationStrip
                                page={data.templatesPage.page}
                                pageSize={data.templatesPage.pageSize}
                                total={data.templatesPage.total}
                                keyPrefix="templates"
                                current={params}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-md border border-border/60 bg-card p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <Send className="h-4 w-4 text-primary" />
                            <h2 className="text-[21px] font-semibold text-foreground">Create campaign</h2>
                        </div>
                        <NewsletterActionForm action={createNewsletterCampaignAction} className="space-y-3">
                            <input name="title" placeholder="Campaign title" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]" required />
                            <select name="audienceId" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]" required defaultValue="">
                                <option value="" disabled>Select audience</option>
                                {data.audiences.map((audience) => <option key={audience.id} value={audience.id}>{audience.name}</option>)}
                            </select>
                            <input name="subjectLine" placeholder="Subject line" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]" required />
                            <input name="preheader" placeholder="Preheader" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]" />
                            <textarea name="bodyMarkdown" placeholder="Campaign body" className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]" required />
                            <input name="scheduledFor" type="datetime-local" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]" />
                            <input type="hidden" name="workflowType" value="broadcast" />
                            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-[17px] font-medium text-primary-foreground">Save campaign</button>
                        </NewsletterActionForm>
                    </div>

                    <div className="rounded-md border border-border/60 bg-card p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <h2 className="text-[21px] font-semibold text-foreground">Convert existing content</h2>
                        </div>
                        <NewsletterActionForm action={createCampaignFromContentAction} className="space-y-3">
                            <select name="contentItemId" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]" required defaultValue="">
                                <option value="" disabled>Select source content</option>
                                {data.sourceContent.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                            </select>
                            <select name="audienceId" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]" required defaultValue="">
                                <option value="" disabled>Select audience</option>
                                {data.audiences.map((audience) => <option key={audience.id} value={audience.id}>{audience.name}</option>)}
                            </select>
                            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-md border border-input px-4 text-[17px] font-medium text-foreground hover:bg-muted">Generate newsletter campaign</button>
                        </NewsletterActionForm>
                    </div>

                    <div className="rounded-md border border-border/60 bg-card p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <Workflow className="h-4 w-4 text-primary" />
                            <h2 className="text-[21px] font-semibold text-foreground">Automations</h2>
                            <span className="text-[15px] text-muted-foreground">({data.automationsPage.total})</span>
                        </div>
                        <NewsletterActionForm action={createNewsletterAutomationAction} className="space-y-3">
                            <input name="name" placeholder="Automation name" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]" required />
                            <select name="triggerType" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]" defaultValue="content_published">
                                <option value="manual">Manual</option>
                                <option value="contact_subscribed">Contact subscribed</option>
                                <option value="content_published">Content published</option>
                            </select>
                            <select name="audienceId" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]" defaultValue="">
                                <option value="">No fixed audience</option>
                                {data.audiences.map((audience) => <option key={audience.id} value={audience.id}>{audience.name}</option>)}
                            </select>
                            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-[17px] font-medium text-primary-foreground">Create automation</button>
                        </NewsletterActionForm>

                        <div className="mt-5">
                            <ListSearchForm name="automationsSearch" defaultValue={automationsSearch} placeholder="Search automations…" preserve={params} />
                            <div className="space-y-4">
                                {data.automations.map((automation) => (
                                    <div key={automation.id} className="rounded-md border border-border/50 bg-background p-4 text-[17px] space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-medium text-foreground">{automation.name}</p>
                                                <p className="text-muted-foreground">{automation.trigger_type} · {automation.status}</p>
                                            </div>
                                            <NewsletterActionForm action={deleteNewsletterAutomationAction}>
                                                <input type="hidden" name="automationId" value={automation.id} />
                                                <button type="submit" className="inline-flex h-8 items-center justify-center rounded-md border border-input px-3 text-[15px] font-medium text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50">Delete</button>
                                            </NewsletterActionForm>
                                        </div>
                                        <NewsletterActionForm action={createNewsletterAutomationStepAction} className="grid gap-3 md:grid-cols-[1fr_80px_100px_auto]">
                                            <input type="hidden" name="automationId" value={automation.id} />
                                            <select name="templateId" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-[17px]" required defaultValue="">
                                                <option value="" disabled>Select template</option>
                                                {data.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                                            </select>
                                            <input name="position" type="number" min="1" defaultValue="1" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-[17px]" />
                                            <input name="delayMinutes" type="number" min="0" defaultValue="0" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-[17px]" />
                                            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-md border border-input px-4 text-[17px] font-medium text-foreground hover:bg-muted">Add step</button>
                                        </NewsletterActionForm>
                                    </div>
                                ))}
                            </div>
                            <PaginationStrip
                                page={data.automationsPage.page}
                                pageSize={data.automationsPage.pageSize}
                                total={data.automationsPage.total}
                                keyPrefix="automations"
                                current={params}
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-md border border-border/60 bg-card p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-2">
                        <Send className="h-4 w-4 text-primary" />
                        <h2 className="text-[21px] font-semibold text-foreground">Campaign queue</h2>
                        <span className="text-[15px] text-muted-foreground">({data.campaignsPage.total})</span>
                    </div>
                    <StatusChips statuses={campaignStatuses} current={params} counts={data.campaignStatusCounts} />
                    <ListSearchForm name="campaignsSearch" defaultValue={campaignsSearch} placeholder="Search by title or subject line…" preserve={params} />
                    <div className="mt-2 space-y-3">
                        {data.campaigns.length === 0 ? (
                            <p className="rounded-md border border-dashed border-border/50 bg-background/40 px-4 py-6 text-center text-[15px] text-muted-foreground">
                                No campaigns match the current filters.
                            </p>
                        ) : (
                            data.campaigns.map((campaign) => (
                                <div key={campaign.id} className="rounded-md border border-border/50 bg-background p-4 text-[17px]">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="font-medium text-foreground">{campaign.title}</p>
                                            <p className="text-muted-foreground">{campaign.subject_line}</p>
                                            <p className="text-[15px] text-muted-foreground">
                                                {campaign.status}
                                                {campaign.scheduled_for ? ` · ${new Date(campaign.scheduled_for).toLocaleString()}` : ""}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <NewsletterActionForm action={sendNewsletterCampaignNowAction}>
                                                <input type="hidden" name="campaignId" value={campaign.id} />
                                                <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-[15px] font-medium text-primary-foreground">Send now</button>
                                            </NewsletterActionForm>
                                            <NewsletterActionForm action={scheduleNewsletterCampaignAction} className="flex items-center gap-2">
                                                <input type="hidden" name="campaignId" value={campaign.id} />
                                                <input name="scheduledFor" type="datetime-local" className="h-9 rounded-md border border-input bg-background px-2 py-1 text-[15px]" />
                                                <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-[15px] font-medium text-foreground hover:bg-muted">Schedule</button>
                                            </NewsletterActionForm>
                                            <NewsletterActionForm action={deleteNewsletterCampaignAction}>
                                                <input type="hidden" name="campaignId" value={campaign.id} />
                                                <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-[15px] font-medium text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50">Delete</button>
                                            </NewsletterActionForm>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <PaginationStrip
                        page={data.campaignsPage.page}
                        pageSize={data.campaignsPage.pageSize}
                        total={data.campaignsPage.total}
                        keyPrefix="campaigns"
                        current={params}
                    />
                </div>

                <div className="rounded-md border border-border/60 bg-card p-6 shadow-sm">
                    <h2 className="text-[21px] font-semibold text-foreground">Recent recipient events</h2>
                    <div className="mt-5 space-y-3">
                        {data.recentRecipients.length > 0 ? (
                            data.recentRecipients.map((recipient) => (
                                <div key={recipient.id} className="rounded-md border border-border/50 bg-background px-4 py-3 text-[17px]">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-medium text-foreground">{recipient.email}</p>
                                            <p className="text-muted-foreground">{recipient.send_status}</p>
                                        </div>
                                        <span className="text-[15px] text-muted-foreground">{new Date(recipient.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-[17px] text-muted-foreground">No recipient events yet.</p>
                        )}
                    </div>
                </div>
            </section>

            <section className="rounded-md border border-border/60 bg-card p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4 text-primary" />
                    <h2 className="text-[21px] font-semibold text-foreground">Contacts</h2>
                    <span className="text-[15px] text-muted-foreground">({data.contactsPage.total})</span>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    <span className="text-[14px] uppercase tracking-wider text-muted-foreground">Status</span>
                    {CONTACT_STATUSES.map((status) => {
                        const active = contactStatuses.includes(status);
                        const nextSet = active ? contactStatuses.filter((s) => s !== status) : [...contactStatuses, status];
                        const href = `/dashboard/newsletter${buildQuery(params, {
                            contactStatus: nextSet.length ? nextSet.join(",") : null,
                            contactsPage: null,
                        })}`;
                        return (
                            <Link
                                key={status}
                                href={href}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[14px] font-medium capitalize transition-colors ${
                                    active
                                        ? "bg-primary text-primary-foreground"
                                        : "border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {status}
                                <span className="rounded-full bg-black/10 px-1.5 text-[13px] font-semibold">{data.contactStatusCounts[status] ?? 0}</span>
                            </Link>
                        );
                    })}
                    {contactStatuses.length > 0 ? (
                        <Link
                            href={`/dashboard/newsletter${buildQuery(params, { contactStatus: null, contactsPage: null })}`}
                            className="text-[14px] text-muted-foreground hover:text-foreground"
                        >
                            Clear
                        </Link>
                    ) : null}
                </div>

                <ListSearchForm
                    name="contactsSearch"
                    defaultValue={contactsSearch}
                    placeholder="Search by email, first or last name…"
                    preserve={params}
                />

                <div className="space-y-3">
                    {data.contacts.length === 0 ? (
                        <p className="rounded-md border border-dashed border-border/50 bg-background/40 px-4 py-6 text-center text-[15px] text-muted-foreground">
                            {contactsSearch || contactStatuses.length > 0 ? "No contacts match the filters." : "No contacts yet."}
                        </p>
                    ) : (
                        data.contacts.map((contact) => {
                            const status = (contact.status as ContactStatus) ?? "subscribed";
                            const tone = CONTACT_STATUS_TONE[status] ?? CONTACT_STATUS_TONE.subscribed;
                            const isTerminal = status === "bounced" || status === "complained";
                            return (
                                <details key={contact.id} className="group rounded-md border border-border/50 bg-background open:bg-muted/20">
                                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[17px]">
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-foreground">{contact.email}</p>
                                            <p className="truncate text-[14px] text-muted-foreground">
                                                {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—"}
                                                {contact.locale ? ` · ${contact.locale}` : ""}
                                                {contact.subscribed_at ? ` · since ${new Date(contact.subscribed_at).toLocaleDateString()}` : ""}
                                            </p>
                                        </div>
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[13px] font-semibold uppercase ${tone}`}>{status}</span>
                                    </summary>

                                    <div className="border-t border-border/40 px-4 py-4">
                                        {isTerminal ? (
                                            <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[14px] text-red-700 dark:text-red-300">
                                                {status === "bounced"
                                                    ? "Address rejected by the destination mail server. Suppressed to protect sender reputation."
                                                    : "Marked as spam by the recipient. Suppressed to protect sender reputation."}
                                                {" "}This status is read-only.
                                            </div>
                                        ) : null}

                                        {(() => {
                                            const metadata = contact.metadata as {
                                                inquiry?: {
                                                    company?: string;
                                                    requestType?: string;
                                                    timeline?: string;
                                                    challenge?: string;
                                                };
                                            } | null | undefined;
                                            const inquiry = metadata?.inquiry;
                                            if (!inquiry) return null;
                                            const hasInquiryData = inquiry.company || inquiry.requestType || inquiry.timeline || inquiry.challenge;
                                            if (!hasInquiryData) return null;
                                            return (
                                                <div className="mb-4 rounded-lg border border-border/50 bg-muted/40 p-3.5 text-[15px] space-y-2.5">
                                                    <h4 className="font-semibold text-foreground text-[14px] uppercase tracking-wider text-primary">Form Inquiry Details</h4>
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        {inquiry.company ? (
                                                            <div>
                                                                <span className="font-medium text-muted-foreground block text-[13px] uppercase">Company</span>
                                                                <span className="text-foreground">{inquiry.company}</span>
                                                            </div>
                                                        ) : null}
                                                        {inquiry.requestType ? (
                                                            <div>
                                                                <span className="font-medium text-muted-foreground block text-[13px] uppercase">Interest</span>
                                                                <span className="text-foreground">{inquiry.requestType}</span>
                                                            </div>
                                                        ) : null}
                                                        {inquiry.timeline ? (
                                                            <div className="sm:col-span-2">
                                                                <span className="font-medium text-muted-foreground block text-[13px] uppercase">Timeline</span>
                                                                <span className="text-foreground">{inquiry.timeline}</span>
                                                            </div>
                                                        ) : null}
                                                        {inquiry.challenge ? (
                                                            <div className="sm:col-span-2">
                                                                <span className="font-medium text-muted-foreground block text-[13px] uppercase">Challenge / Message</span>
                                                                <div className="mt-1 rounded-md border border-border/60 bg-background px-3 py-2 text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                                                                    {inquiry.challenge}
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <NewsletterActionForm
                                            action={updateNewsletterContactAction}
                                            className="mt-3 grid gap-3 md:grid-cols-2"
                                        >
                                            <input type="hidden" name="contactId" value={contact.id} />
                                            <div>
                                                <label className="mb-1 block text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">First name</label>
                                                <input
                                                    name="firstName"
                                                    defaultValue={contact.first_name ?? ""}
                                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-[17px]"
                                                    disabled={isTerminal}
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Last name</label>
                                                <input
                                                    name="lastName"
                                                    defaultValue={contact.last_name ?? ""}
                                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-[17px]"
                                                    disabled={isTerminal}
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Locale</label>
                                                <select
                                                    name="locale"
                                                    defaultValue={contact.locale ?? ""}
                                                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-[17px]"
                                                    disabled={isTerminal}
                                                >
                                                    <option value="">—</option>
                                                    <option value="en">en</option>
                                                    <option value="nl">nl</option>
                                                    <option value="ar">ar</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
                                                <select
                                                    name="status"
                                                    defaultValue={status}
                                                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-[17px]"
                                                    disabled={isTerminal}
                                                >
                                                    {/* Only render the transitions the server will accept */}
                                                    {status === "pending" && <option value="pending">pending</option>}
                                                    {status === "subscribed" && <option value="subscribed">subscribed</option>}
                                                    {status === "unsubscribed" && <option value="unsubscribed">unsubscribed</option>}
                                                    {(status === "pending" || status === "unsubscribed") && <option value="subscribed">subscribed</option>}
                                                    {(status === "pending" || status === "subscribed") && <option value="unsubscribed">unsubscribed</option>}
                                                    {isTerminal && <option value={status}>{status}</option>}
                                                </select>
                                            </div>
                                            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1">
                                                <p className="text-[13px] text-muted-foreground">
                                                    {contact.verified_at ? `Verified ${new Date(contact.verified_at).toLocaleDateString()}` : "Not verified"}
                                                    {contact.bounced_at ? ` · Bounced ${new Date(contact.bounced_at).toLocaleDateString()}` : ""}
                                                    {contact.complained_at ? ` · Complained ${new Date(contact.complained_at).toLocaleDateString()}` : ""}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    {status !== "unsubscribed" && !isTerminal ? (
                                                        <NewsletterActionForm action={unsubscribeNewsletterContactAction}>
                                                            <input type="hidden" name="contactId" value={contact.id} />
                                                            <button type="submit" className="inline-flex h-9 items-center rounded-md border border-input px-3 text-[15px] font-medium text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50">Unsubscribe</button>
                                                        </NewsletterActionForm>
                                                    ) : null}
                                                    <button
                                                        type="submit"
                                                        disabled={isTerminal}
                                                        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-[15px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        </NewsletterActionForm>
                                    </div>
                                </details>
                            );
                        })
                    )}
                </div>

                <PaginationStrip
                    page={data.contactsPage.page}
                    pageSize={data.contactsPage.pageSize}
                    total={data.contactsPage.total}
                    keyPrefix="contacts"
                    current={params}
                />
            </section>
        </div>
        </DashboardAppWorkbench>
    );
}
