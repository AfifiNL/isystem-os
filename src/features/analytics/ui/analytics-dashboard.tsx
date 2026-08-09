import Link from "next/link";
import { BarChart3, Headphones, MousePointerClick, FileText, SearchCheck, Users } from "lucide-react";
import { AppFeedbackLoop, AppMetric, AppMetricStrip, AppTrendChart } from "@/features/admin/ui/app-workbench";

export function AnalyticsDashboard({
    analytics,
}: {
    analytics: {
        totalEvents: number;
        totalPageViews: number;
        totalConversions: number;
        totalCtaClicks: number;
        topPages: Array<{ slug: string; views: number }>;
        dailyTrend: Array<{ date: string; views: number }>;
        recentConversions: Array<{ event_type?: string; event_name: string; page_slug: string | null; created_at: string }>;
        newsletter: {
            campaigns: number;
            contacts: number;
            automations: number;
            opens: number;
            clicks: number;
        };
        audio?: {
            plays: number;
            progress: number;
            completes: number;
        };
    };
}) {
    const cards = [
        { label: "Events", value: analytics.totalEvents, icon: BarChart3 },
        { label: "Page Views", value: analytics.totalPageViews, icon: FileText },
        { label: "CTA Clicks", value: analytics.totalCtaClicks, icon: MousePointerClick },
        { label: "Conversions", value: analytics.totalConversions, icon: Users },
    ];
    const clickThroughRate = analytics.totalPageViews > 0
        ? ((analytics.totalCtaClicks / analytics.totalPageViews) * 100).toFixed(1)
        : "0.0";
    const conversionRate = analytics.totalPageViews > 0
        ? ((analytics.totalConversions / analytics.totalPageViews) * 100).toFixed(1)
        : "0.0";

    return (
        <div className="space-y-4">
            <AppMetricStrip>
                {cards.map((card) => (
                    <AppMetric
                        key={card.label}
                        label={card.label}
                        value={card.value}
                        icon={card.icon}
                    />
                ))}
            </AppMetricStrip>

            <AppFeedbackLoop
                title="Audience-to-outcome loop"
                description="A compact causal view of how attention becomes intent, conversion, and a reusable audience."
                stages={[
                    { label: "Attention", value: analytics.totalPageViews, detail: "page views", tone: "info" },
                    { label: "Intent", value: analytics.totalCtaClicks, detail: `${clickThroughRate}% of views`, tone: analytics.totalCtaClicks > 0 ? "warning" : "default" },
                    { label: "Outcome", value: analytics.totalConversions, detail: `${conversionRate}% conversion`, tone: analytics.totalConversions > 0 ? "success" : "default" },
                    { label: "Audience", value: analytics.newsletter.contacts, detail: "newsletter contacts", tone: "info" },
                ]}
                feedbackLabel="Conversion and subscriber behavior should change the next content and CTA decision; traffic without downstream movement is a diagnostic signal."
            />

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <AppTrendChart
                    title="Traffic trend"
                    description="Daily page views across the selected operating window."
                    valueLabel="views"
                    data={analytics.dailyTrend.map((item) => ({ label: item.date, value: item.views }))}
                />

                <section className="rounded-md border border-border/60 bg-card/40 p-4 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-[15px] font-semibold text-foreground uppercase tracking-wider">Top pages</h2>
                        <Link
                            href="/dashboard/seo"
                            className="inline-flex items-center gap-1 text-[14px] text-primary hover:underline font-medium"
                            title="Open the SEO Control Center to audit underperforming pages"
                        >
                            <SearchCheck className="h-3 w-3" />
                            Audit in SEO
                        </Link>
                    </div>
                    <div className="mt-4 space-y-2">
                        {analytics.topPages.length > 0 ? analytics.topPages.map((page) => (
                            <div key={page.slug} className="flex flex-col gap-1.5 rounded-md border border-border/50 bg-background/50 px-3 py-2 text-[15px] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                <span className="break-all font-medium text-foreground">/{page.slug}</span>
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-muted-foreground">{page.views} views</span>
                                    <Link
                                        href={`/dashboard/seo?slug=${encodeURIComponent(page.slug)}`}
                                        className="text-[13px] text-primary hover:underline font-semibold"
                                    >
                                        Audit →
                                    </Link>
                                </div>
                            </div>
                        )) : <p className="text-[15px] text-muted-foreground">No top pages yet.</p>}
                    </div>
                </section>
            </div>

            <section className="rounded-md border border-border/60 bg-card/40 p-4 shadow-2xs">
                <h2 className="text-[15px] font-semibold text-foreground uppercase tracking-wider">Recent conversions</h2>
                <div className="mt-4 space-y-2">
                    {analytics.recentConversions.length > 0 ? analytics.recentConversions.map((item, index) => (
                        <div key={`${item.created_at}-${index}`} className="flex flex-col gap-1.5 rounded-md border border-border/50 bg-background/50 px-3 py-2 text-[15px] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div className="min-w-0">
                                <p className="font-semibold text-foreground">{item.event_name}</p>
                                <p className="text-muted-foreground text-[13px]">{item.page_slug ? `/${item.page_slug}` : "Unknown page"}</p>
                            </div>
                            <span className="text-muted-foreground sm:text-right text-[13px]">{new Date(item.created_at).toLocaleString()}</span>
                        </div>
                    )) : <p className="text-[15px] text-muted-foreground">No conversion events yet.</p>}
                </div>
            </section>

            <section className="rounded-md border border-border/60 bg-card/40 p-4 shadow-2xs">
                <div className="flex items-center gap-2">
                    <Headphones className="h-3.5 w-3.5 text-primary" />
                    <h2 className="text-[15px] font-semibold text-foreground uppercase tracking-wider">Podcast audio engagement</h2>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border border-border/50 bg-background/50 px-3.5 py-2.5 text-[15px]">
                        <p className="text-muted-foreground text-[13px] uppercase font-semibold">Plays</p>
                        <p className="mt-1 text-[23px] font-bold text-foreground">{analytics.audio?.plays ?? 0}</p>
                    </div>
                    <div className="rounded-md border border-border/50 bg-background/50 px-3.5 py-2.5 text-[15px]">
                        <p className="text-muted-foreground text-[13px] uppercase font-semibold">Progress milestones</p>
                        <p className="mt-1 text-[23px] font-bold text-foreground">{analytics.audio?.progress ?? 0}</p>
                    </div>
                    <div className="rounded-md border border-border/50 bg-background/50 px-3.5 py-2.5 text-[15px]">
                        <p className="text-muted-foreground text-[13px] uppercase font-semibold">Completes</p>
                        <p className="mt-1 text-[23px] font-bold text-foreground">{analytics.audio?.completes ?? 0}</p>
                    </div>
                </div>
            </section>

            <section className="rounded-md border border-border/60 bg-card/40 p-4 shadow-2xs">
                <h2 className="text-[15px] font-semibold text-foreground uppercase tracking-wider">Newsletter operations</h2>
                <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-5 text-[15px]">
                    <div className="rounded-md border border-border/50 bg-background/50 px-3.5 py-2.5 text-[15px]">
                        <p className="text-muted-foreground text-[13px] uppercase font-semibold">Campaigns</p>
                        <p className="mt-1 text-[23px] font-bold text-foreground">{analytics.newsletter.campaigns}</p>
                    </div>
                    <div className="rounded-md border border-border/50 bg-background/50 px-3.5 py-2.5 text-[15px]">
                        <p className="text-muted-foreground text-[13px] uppercase font-semibold">Contacts</p>
                        <p className="mt-1 text-[23px] font-bold text-foreground">{analytics.newsletter.contacts}</p>
                    </div>
                    <div className="rounded-md border border-border/50 bg-background/50 px-3.5 py-2.5 text-[15px]">
                        <p className="text-muted-foreground text-[13px] uppercase font-semibold">Automations</p>
                        <p className="mt-1 text-[23px] font-bold text-foreground">{analytics.newsletter.automations}</p>
                    </div>
                    <div className="rounded-md border border-border/50 bg-background/50 px-3.5 py-2.5 text-[15px]">
                        <p className="text-muted-foreground text-[13px] uppercase font-semibold">Opens</p>
                        <p className="mt-1 text-[23px] font-bold text-foreground">{analytics.newsletter.opens}</p>
                    </div>
                    <div className="rounded-md border border-border/50 bg-background/50 px-3.5 py-2.5 text-[15px]">
                        <p className="text-muted-foreground text-[13px] uppercase font-semibold">Clicks</p>
                        <p className="mt-1 text-[23px] font-bold text-foreground">{analytics.newsletter.clicks}</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
