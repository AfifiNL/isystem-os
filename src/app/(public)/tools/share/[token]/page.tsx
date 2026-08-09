import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarCheck, Share2, Sparkles } from "lucide-react";
import { fetchLeadByShareToken } from "@/features/tools/shared/store";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { getToolMeta } from "@/features/tools/shared/registry";
import { SharedResultRenderer } from "@/features/tools/shared/ui/SharedResultRenderer";
import { ToolAtmosphere, ToolEyebrow, ToolPanel } from "@/features/tools/shared/ui/primitives";
import { ShareActions } from "@/features/tools/shared/ui/ShareActions";
import { getSiteSettings } from "@/features/templates/actions";
import { requirePublicToolsBrandReady } from "@/features/tools/shared/availability";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
    title: "Shared tool result · iSystem",
    robots: { index: false, follow: false },
};

const LOCALE_GREETING: Record<"en" | "nl" | "ar", string> = {
    en: "Shared result",
    nl: "Gedeeld resultaat",
    ar: "نتيجة مشتركة",
};

const SHARE_COPY: Record<"en" | "nl" | "ar", { generated: string; sharedResult: string; runTool: string; talk: string; footer: string }> = {
    en: { generated: "Generated", sharedResult: "Shared result", runTool: "Run the tool yourself", talk: "Talk to iSystem", footer: "Free public tools by iSystem.ai" },
    nl: { generated: "Gegenereerd", sharedResult: "Gedeeld resultaat", runTool: "Gebruik de tool zelf", talk: "Praat met iSystem", footer: "Gratis publieke tools van iSystem.ai" },
    ar: { generated: "تم الإنشاء", sharedResult: "نتيجة مشتركة", runTool: "جرّب الأداة بنفسك", talk: "تحدّث مع iSystem", footer: "أدوات عامة مجانية من iSystem.ai" },
};

export default async function ShareResultPage({ params }: PageProps) {
    const settings = await getSiteSettings();
    requirePublicToolsBrandReady(settings.activeTemplate);
    const { token } = await params;
    if (!token || token.length < 12 || token.length > 32) {
        notFound();
    }
    const lead = await fetchLeadByShareToken(token);
    if (!lead) {
        notFound();
    }
    const meta = getToolMeta(lead.tool);
    const dir = lead.locale === "ar" ? "rtl" : undefined;
    const copy = SHARE_COPY[lead.locale];

    return (
        <section
            dir={dir}
            className="relative isolate overflow-hidden bg-slate-950 py-20 text-slate-50 sm:py-24 print:bg-white print:py-0 print:text-slate-900"
        >
            <ToolAtmosphere />

            <div className="mx-auto max-w-3xl px-4 sm:px-6 print:max-w-none print:px-0">
                <header className="text-center print:hidden">
                    <ToolEyebrow icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}>
                        {LOCALE_GREETING[lead.locale]} · iSystem
                    </ToolEyebrow>
                    <h1 className="mt-6 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                        {meta.title[lead.locale]}
                    </h1>
                    <p className="mt-3 text-sm text-slate-400">
                        {copy.generated}{" "}
                        <time dateTime={lead.createdAt}>
                            {new Date(lead.createdAt).toLocaleDateString(lead.locale === "ar" ? "en" : lead.locale, {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </time>
                    </p>
                </header>

                <div className="mt-10 print:mt-0">
                    <ToolPanel>
                        <div className="hidden print:block">
                            <h2 className="text-2xl font-bold text-slate-900">{meta.title[lead.locale]}</h2>
                            <p className="mt-1 text-sm text-slate-700">
                                {copy.sharedResult} · {copy.generated} {new Date(lead.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                        <SharedResultRenderer tool={lead.tool} result={lead.result} />
                    </ToolPanel>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 print:hidden">
                    <Link
                        href={localizeHref(lead.locale, `/tools/${lead.tool}`)}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cyan-500 px-7 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)]"
                    >
                        {copy.runTool} <ArrowRight className="size-4" aria-hidden />
                    </Link>
                    <Link
                        href={localizeHref(lead.locale, "/booking")}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium text-white hover:border-cyan-400/40 hover:bg-white/10"
                    >
                        <CalendarCheck className="size-4" aria-hidden /> {copy.talk}
                    </Link>
                    <ShareActions />
                </div>

                <p className="mt-12 text-center text-xs uppercase tracking-[0.22em] text-slate-500 print:text-slate-600">
                    <Share2 className="mr-1.5 inline-block size-3.5" aria-hidden />
                    {copy.footer}
                </p>
            </div>
        </section>
    );
}
