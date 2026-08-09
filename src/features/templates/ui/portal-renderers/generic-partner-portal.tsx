import Link from "next/link";
import { headers } from "next/headers";
import { ArrowUpRight, Compass, LifeBuoy, Megaphone, ShieldCheck, Sparkles } from "lucide-react";
import type { PartnerPortalWorkspace } from "@/features/portal/actions/portal-access";
import type { PartnerAnnouncement, PartnerAnnouncementTone } from "@/features/portal/actions/announcements";
import {
    DEFAULT_LOCALE,
    LOCALE_HEADER_KEY,
    getLocaleBcp47,
    isSupportedLocale,
} from "@/shared/lib/i18n/routing";
import { localizeHref } from "@/shared/lib/i18n/routing";
import type { Locale } from "@/features/templates/types";

interface GenericPartnerPortalProps {
    workspace: PartnerPortalWorkspace;
    announcements: PartnerAnnouncement[];
}

const TIER_LABEL: Record<Locale, Record<PartnerPortalWorkspace["tier"], string>> = {
    en: { basic: "Basic", pro: "Pro" },
    nl: { basic: "Basic", pro: "Pro" },
    ar: { basic: "أساسي", pro: "احترافي" },
};

const TONE_CLASS: Record<PartnerAnnouncementTone, string> = {
    info: "border-white/10 bg-white/[0.03] text-slate-200",
    milestone: "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200",
    action: "border-amber-400/30 bg-amber-400/[0.06] text-amber-200",
};

const TONE_LABEL: Record<Locale, Record<PartnerAnnouncementTone, string>> = {
    en: { info: "Update", milestone: "Milestone", action: "Action needed" },
    nl: { info: "Update", milestone: "Mijlpaal", action: "Actie vereist" },
    ar: { info: "تحديث", milestone: "إنجاز", action: "إجراء مطلوب" },
};

const STATIC_ROADMAP: Record<Locale, readonly string[]> = {
    en: [
        "Delivery timeline and sprint cadence",
        "Shared assets and execution artifacts",
        "Operational metrics for live features",
    ],
    nl: [
        "Leveringstijdlijn en sprint cadans",
        "Gedeelde assets en uitvoeringsartefacten",
        "Operationele metrics voor live features",
    ],
    ar: [
        "الجدول الزمني للتسليم وإيقاع السبرينت",
        "الأصول المشتركة وأدوات التنفيذ",
        "المقاييس التشغيلية للميزات النشطة",
    ],
};

const COPY: Record<Locale, {
    eyebrow: string;
    intro: string;
    secureSession: string;
    workspaceTitle: string;
    workspaceBody: string;
    template: string;
    tier: string;
    locale: string;
    updatesTitleHas: string;
    updatesTitleEmpty: string;
    updatesBodyHas: string;
    updatesBodyEmpty: string;
    helpTitle: string;
    helpBody: string;
    contactDelivery: string;
    returnHome: string;
    refreshNote: string;
}> = {
    en: {
        eyebrow: "Partner Portal",
        intro: "Your dedicated workspace for delivery updates, operational signals, and collaboration with your delivery lead.",
        secureSession: "Secure session",
        workspaceTitle: "Your workspace",
        workspaceBody: "Custom modules for this workspace are provisioned as your engagement progresses. Your delivery lead will surface new dashboards and data streams here as they go live.",
        template: "Template",
        tier: "Tier",
        locale: "Locale",
        updatesTitleHas: "Latest updates",
        updatesTitleEmpty: "What's next",
        updatesBodyHas: "Recent delivery notes, milestones, and action items from your delivery team.",
        updatesBodyEmpty: "Operational dashboards, release notes, and delivery artifacts will appear here as they are scoped.",
        helpTitle: "Need help?",
        helpBody: "Reach your delivery lead for access changes, scope questions, or new module requests.",
        contactDelivery: "Contact delivery lead",
        returnHome: "Return to the website",
        refreshNote: "Partner Portal · Data refreshed on page load",
    },
    nl: {
        eyebrow: "Partnerportaal",
        intro: "Uw eigen werkruimte voor delivery-updates, operationele signalen en samenwerking met uw delivery lead.",
        secureSession: "Beveiligde sessie",
        workspaceTitle: "Uw werkruimte",
        workspaceBody: "Maatwerkmodules voor deze werkruimte worden geactiveerd naarmate uw traject vordert. Uw delivery lead voegt hier nieuwe dashboards en gegevensstromen toe zodra ze live zijn.",
        template: "Sjabloon",
        tier: "Niveau",
        locale: "Taal",
        updatesTitleHas: "Laatste updates",
        updatesTitleEmpty: "Wat volgt",
        updatesBodyHas: "Recente delivery-notities, mijlpalen en actiepunten van uw delivery-team.",
        updatesBodyEmpty: "Operationele dashboards, release notes en delivery-artefacten verschijnen hier zodra ze in scope komen.",
        helpTitle: "Hulp nodig?",
        helpBody: "Neem contact op met uw delivery lead voor toegangswijzigingen, scopevragen of nieuwe modules.",
        contactDelivery: "Contact delivery lead",
        returnHome: "Terug naar de website",
        refreshNote: "Partner Portal · Gegevens vernieuwd bij laden",
    },
    ar: {
        eyebrow: "بوابة الشريك",
        intro: "مساحة عملك المخصّصة لتحديثات التسليم والإشارات التشغيلية والتعاون مع مسؤول التسليم.",
        secureSession: "جلسة آمنة",
        workspaceTitle: "مساحة عملك",
        workspaceBody: "تُهيَّأ الوحدات المخصصة لهذه المساحة بحسب تقدّم تعاونك. سيُضيف مسؤول التسليم هنا لوحات معلومات وتدفقات بيانات جديدة فور إطلاقها.",
        template: "القالب",
        tier: "المستوى",
        locale: "اللغة",
        updatesTitleHas: "آخر التحديثات",
        updatesTitleEmpty: "ما القادم",
        updatesBodyHas: "ملاحظات التسليم الأخيرة والإنجازات والمهام من فريق التسليم الخاص بك.",
        updatesBodyEmpty: "ستظهر هنا لوحات المعلومات التشغيلية وملاحظات الإصدار وأدوات التسليم بمجرد تحديد نطاقها.",
        helpTitle: "تحتاج مساعدة؟",
        helpBody: "تواصل مع مسؤول التسليم لتغييرات الوصول أو أسئلة النطاق أو طلبات الوحدات الجديدة.",
        contactDelivery: "تواصل مع مسؤول التسليم",
        returnHome: "العودة إلى الموقع",
        refreshNote: "بوابة الشريك · يتم تحديث البيانات عند تحميل الصفحة",
    },
};

function formatPublishedDate(value: string, bcp47Locale: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleDateString(bcp47Locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function WorkspaceBadge({ tier, locale }: { tier: PartnerPortalWorkspace["tier"]; locale: Locale }) {
    const isPro = tier === "pro";
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                isPro
                    ? "border border-[#4A90E2]/40 bg-[#4A90E2]/10 text-[#4A90E2]"
                    : "border border-white/10 bg-white/5 text-white/60"
            }`}
        >
            <Sparkles className="h-3 w-3" /> {TIER_LABEL[locale][tier]}
        </span>
    );
}

function AnnouncementsSection({
    announcements,
    bcp47Locale,
    locale,
}: {
    announcements: PartnerAnnouncement[];
    bcp47Locale: string;
    locale: Locale;
}) {
    if (announcements.length === 0) {
        return (
            <ul className="mt-5 space-y-2 text-sm text-slate-300">
                {STATIC_ROADMAP[locale].map((item) => (
                    <li key={item} className="flex items-start gap-2 border-t border-white/5 pt-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#4A90E2]" />
                        {item}
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <ul className="mt-5 space-y-3">
            {announcements.map((announcement) => (
                <li
                    key={announcement.id}
                    className={`rounded-xl border p-4 ${TONE_CLASS[announcement.tone]}`}
                >
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-80">
                            {TONE_LABEL[locale][announcement.tone]}
                        </span>
                        <span className="text-[10px] text-white/50">
                            {formatPublishedDate(announcement.publishedAt, bcp47Locale)}
                        </span>
                    </div>
                    <p className="text-sm font-semibold">{announcement.title}</p>
                    {announcement.body ? (
                        <p className="mt-1 text-xs leading-relaxed opacity-80">{announcement.body}</p>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}

export default async function GenericPartnerPortal({ workspace, announcements }: GenericPartnerPortalProps) {
    const displayName = workspace.companyName ?? workspace.name;
    const hasAnnouncements = announcements.length > 0;
    const headerStore = await headers();
    const headerLocale = headerStore.get(LOCALE_HEADER_KEY);
    const locale: Locale = isSupportedLocale(headerLocale) ? headerLocale : DEFAULT_LOCALE;
    const bcp47Locale = getLocaleBcp47(locale);
    const t = COPY[locale];

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#4A90E2] opacity-[0.08] blur-[140px]" />
                <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-[#002f58] opacity-[0.18] blur-[140px]" />
            </div>

            <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
                <header className="mb-12 flex flex-col gap-4 border-b border-white/5 pb-10 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#4A90E2]">
                            {t.eyebrow}
                        </p>
                        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                            {displayName}
                        </h1>
                        <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
                            {t.intro}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <WorkspaceBadge tier={workspace.tier} locale={locale} />
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
                            <ShieldCheck className="h-3 w-3" /> {t.secureSession}
                        </span>
                    </div>
                </header>

                <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm">
                        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                            <Compass className="h-5 w-5 text-[#4A90E2]" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">{t.workspaceTitle}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                            {t.workspaceBody}
                        </p>
                        <dl className="mt-5 space-y-2 text-sm">
                            <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                <dt className="text-slate-500">{t.template}</dt>
                                <dd className="font-medium text-slate-200">{workspace.templateId}</dd>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                <dt className="text-slate-500">{t.tier}</dt>
                                <dd className="font-medium text-slate-200">{TIER_LABEL[locale][workspace.tier]}</dd>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                <dt className="text-slate-500">{t.locale}</dt>
                                <dd className="font-medium uppercase text-slate-200">{workspace.locale}</dd>
                            </div>
                        </dl>
                    </article>

                    <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm">
                        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                            <Megaphone className="h-5 w-5 text-[#4A90E2]" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">
                            {hasAnnouncements ? t.updatesTitleHas : t.updatesTitleEmpty}
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                            {hasAnnouncements ? t.updatesBodyHas : t.updatesBodyEmpty}
                        </p>
                        <AnnouncementsSection announcements={announcements} bcp47Locale={bcp47Locale} locale={locale} />
                    </article>

                    <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm">
                        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                            <LifeBuoy className="h-5 w-5 text-[#4A90E2]" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">{t.helpTitle}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                            {t.helpBody}
                        </p>
                        <div className="mt-5 flex flex-col gap-2">
                            <Link
                                href={localizeHref(locale, "/contact")}
                                className="group inline-flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.06]"
                            >
                                {t.contactDelivery}
                                <ArrowUpRight className="h-4 w-4 text-[#4A90E2] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl-flip" />
                            </Link>
                            <Link
                                href={localizeHref(locale, "/")}
                                className="group inline-flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.06]"
                            >
                                {t.returnHome}
                                <ArrowUpRight className="h-4 w-4 text-[#4A90E2] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl-flip" />
                            </Link>
                        </div>
                    </article>
                </section>

                <p className="mt-12 text-center text-[11px] uppercase tracking-[0.28em] text-white/30">
                    {t.refreshNote}
                </p>
            </div>
        </div>
    );
}
