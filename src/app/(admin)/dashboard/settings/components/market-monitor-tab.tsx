"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Save, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { upsertMarketMonitorConfig } from "@/features/market-monitor/actions";
import type { MarketMonitorConfig } from "@/features/market-monitor/types";

interface MarketMonitorTabProps {
    config: MarketMonitorConfig | null;
}

function joinList(values: string[] | undefined): string {
    return (values ?? []).join("\n");
}

function splitList(raw: string): string[] {
    return raw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

export function MarketMonitorTab({ config }: MarketMonitorTabProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [competitors, setCompetitors] = useState(joinList(config?.competitor_domains));
    const [authority, setAuthority] = useState(joinList(config?.authority_domains));
    const [keywords, setKeywords] = useState(joinList(config?.industry_keywords));
    const [enabled, setEnabled] = useState(config?.enabled ?? false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSave = () => {
        setError(null);
        setSuccess(false);
        startTransition(async () => {
            const result = await upsertMarketMonitorConfig({
                competitorDomains: splitList(competitors),
                authorityDomains: splitList(authority),
                industryKeywords: splitList(keywords),
                enabled,
            });
            if (result.error) {
                setError(result.error);
                return;
            }
            setSuccess(true);
            router.refresh();
            setTimeout(() => setSuccess(false), 3000);
        });
    };

    return (
        <section id="market-monitor" className="space-y-6">
            <header className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[17px] font-semibold uppercase tracking-[0.2em] text-primary">
                    <TrendingUp className="h-3.5 w-3.5" /> Market Monitor
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight">Competitor &amp; authority watch</h2>
                <p className="mt-1 text-[17px] text-muted-foreground">
                    Configure the domains and keywords the monitor uses to scan for new competitor posts, authority-source publications, and industry signals. Runs on the schedule set by the cron endpoint — results appear in the Market Monitor dashboard and the main inbox.
                </p>
            </header>

            <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm space-y-5">
                <label className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/60 px-4 py-3">
                    <div>
                        <p className="text-[17px] font-medium">Enable monitor</p>
                        <p className="text-[15px] text-muted-foreground">When disabled, scheduled scans skip this workspace.</p>
                    </div>
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="h-5 w-5 accent-primary"
                        disabled={isPending}
                    />
                </label>

                <Field
                    label="Competitor domains"
                    hint="One domain per line. Direct competitors whose new posts should surface as signals."
                    placeholder="competitor-a.com&#10;competitor-b.com"
                    value={competitors}
                    onChange={setCompetitors}
                    disabled={isPending}
                />
                <Field
                    label="Authority sources"
                    hint="One domain per line. Trusted publishers whose coverage of your topics should surface."
                    placeholder="reuters.com&#10;bloomberg.com"
                    value={authority}
                    onChange={setAuthority}
                    disabled={isPending}
                />
                <Field
                    label="Industry keywords"
                    hint="One phrase per line. Used as Tavily search queries when scanning the web."
                    placeholder="ai content platform&#10;enterprise seo automation"
                    value={keywords}
                    onChange={setKeywords}
                    disabled={isPending}
                />

                <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                    {error ? (
                        <p className="inline-flex items-center gap-1.5 text-[15px] text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            {error}
                        </p>
                    ) : success ? (
                        <p className="text-[15px] text-emerald-700 dark:text-emerald-300">Configuration saved.</p>
                    ) : (
                        <span className="text-[15px] text-muted-foreground">Changes apply to the next scheduled scan.</span>
                    )}
                    <Button onClick={handleSave} disabled={isPending}>
                        {isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save configuration
                    </Button>
                </div>
            </div>
        </section>
    );
}

function Field({
    label,
    hint,
    placeholder,
    value,
    onChange,
    disabled,
}: {
    label: string;
    hint: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
}) {
    return (
        <div>
            <label className="text-[17px] font-medium text-foreground">{label}</label>
            <p className="mt-0.5 text-[15px] text-muted-foreground">{hint}</p>
            <Textarea
                className="mt-2 min-h-[100px] font-mono text-[15px]"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />
        </div>
    );
}
