import React, { type ReactNode } from "react";
import Link from "next/link";
import {
    ISYSTEM_COMMERCIAL_OFFER,
    ISYSTEM_PUBLIC_OFFER_NOTES,
    formatCommercialPrice,
    getIsystemPublicOfferName,
} from "@/features/marketing/isystem-commercial-offer";
import {
    ISYSTEM_PUBLIC_CAPABILITIES,
    ISYSTEM_PUBLIC_SCOPE_COLUMNS,
    ISYSTEM_PUBLIC_SYSTEMS,
    type IsystemCapabilityStatus,
} from "@/features/marketing/isystem-public-truth";
import type { Locale } from "@/features/templates/types";
import { getIsystemPublicBlockDefaults } from "./isystem-public-copy";
import {
    type PublicPageDefinition,
    type PublicPagePuckBlock,
    type PublicPagePuckDataV2,
} from "./public-page-contract";
import { PublicPageMotionController } from "./public-page-motion";
import { PublicContactForm } from "@/features/contact/ui/public-contact-form";

export type PublicPageRenderMode = "preview" | "published" | "fixture";

export interface PublicDataSnapshot {
    status: "loading" | "ready" | "empty" | "error" | "unavailable";
    data?: unknown;
    message?: string;
}

export interface PublicPageRendererProps {
    definition: PublicPageDefinition;
    data: PublicPagePuckDataV2;
    locale: Locale;
    mode: PublicPageRenderMode;
    templateId?: string;
    dataSnapshots?: Record<string, PublicDataSnapshot>;
    className?: string;
}

type LocalizedValue = string | { en?: string; nl?: string; ar?: string } | undefined;

function localized(value: LocalizedValue, locale: Locale, fallback = ""): string {
    if (typeof value === "string") {
        return locale === "en" || !fallback ? value : fallback;
    }
    if (!value) return fallback;
    const candidate = value[locale];
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
    if (locale !== "en" && fallback) return fallback;
    return value.en ?? value.nl ?? value.ar ?? fallback;
}

function localeText(locale: Locale, en: string, nl: string, ar: string): string {
    return localized({ en, nl, ar }, locale);
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function localizedItem(value: unknown, nestedKey: string, locale: Locale, fallback = ""): string {
    if (typeof value === "string") return value;
    const record = asRecord(value);
    const isDirectLocalizedValue = ["en", "nl", "ar"].some((key) => typeof record[key] === "string");
    return localized(
        (isDirectLocalizedValue ? record : record[nestedKey]) as LocalizedValue,
        locale,
        fallback,
    );
}

function capabilityStatusLabel(status: IsystemCapabilityStatus, locale: Locale): string {
    const labels: Record<IsystemCapabilityStatus, LocalizedValue> = {
        shipped: { en: "Shipped", nl: "Geleverd", ar: "متاح" },
        configured: { en: "Configured", nl: "Ingericht", ar: "مهيأ" },
        assisted: { en: "Assisted", nl: "Ondersteund", ar: "بمساعدة" },
        roadmap: { en: "Roadmap", nl: "Routekaart", ar: "خارطة الطريق" },
    };
    return localized(labels[status], locale);
}

function prop(block: PublicPagePuckBlock, key: string): unknown {
    return block.props[key];
}

function text(block: PublicPagePuckBlock, key: string, locale: Locale, fallback = ""): string {
    const canonicalFallback = localized(
        getIsystemPublicBlockDefaults(block.type)[key] as LocalizedValue,
        locale,
        fallback,
    );
    return localized(prop(block, key) as LocalizedValue, locale, canonicalFallback);
}

function defaultItems(type: string, key: string): unknown[] {
    const value = getIsystemPublicBlockDefaults(type)[key];
    return Array.isArray(value) ? value : [];
}

function href(block: PublicPagePuckBlock, key: string, fallback = "/booking"): string {
    const value = prop(block, key);
    return typeof value === "string" && value.startsWith("/") ? value : fallback;
}

function ButtonLink({ href: link, children, secondary = false }: { href: string; children: ReactNode; secondary?: boolean }) {
    return (
        <Link
            href={link}
            className={`isystem-public-button group inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius-md)] px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-action)] ${secondary
                ? "border border-[var(--public-line)] bg-[var(--public-paper)] text-[var(--public-ink)] hover:border-[var(--public-action)] hover:text-[var(--public-action-strong)]"
                : "bg-[var(--public-action)] text-white hover:bg-[var(--public-action-strong)]"}`}
            style={{ color: secondary ? "var(--public-ink)" : "#fff" }}
        >
            <span>{children}</span>
            <span className="isystem-public-button-arrow rtl-flip" aria-hidden="true">&#8594;</span>
        </Link>
    );
}

function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
    return <section className={`isystem-public-section ${className}`} id={id}>{children}</section>;
}

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
    return <div className={`isystem-public-container ${className}`}>{children}</div>;
}

function OutcomeHero({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    const headline = text(block, "headline", locale, "Turn a scattered digital operation into one accountable system.");
    const subtitle = text(block, "subtitle", locale, "iSystem designs, implements, and operates the digital systems around your service business, with Hossam accountable for the result.");
    const primaryLabel = text(block, "primaryCtaLabel", locale, "Book the free Systems Fit Call");
    const secondaryLabel = text(block, "secondaryCtaLabel", locale, "See how the system works");
    const evidencePreference = prop(block, "showEvidence");
    const blockId = typeof prop(block, "id") === "string" ? prop(block, "id") as string : "";
    const compactHeroIds = new Set(["services-outcome-hero", "about-outcome-hero", "contact-outcome-hero"]);
    const showEvidence = typeof evidencePreference === "boolean"
        ? evidencePreference
        : !compactHeroIds.has(blockId);
    const showCommercial = prop(block, "showCommercial") !== false;
    return (
        <Section className={`isystem-public-hero border-b border-[var(--public-line)] bg-[var(--public-canvas)] pb-16 pt-16 sm:pb-20 sm:pt-20 ${showEvidence ? "" : "isystem-public-hero--compact"}`}>
            <Container>
                <div className={`grid items-end gap-12 ${showEvidence ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]" : "max-w-5xl"}`}>
                    <div className="relative z-10 max-w-4xl" data-public-hero-copy>
                        <p className="isystem-public-eyebrow mb-6">{text(block, "eyebrow", locale, "Founder-led digital systems for Dutch service SMEs")}</p>
                        <h1 className="isystem-public-display max-w-4xl">{headline}</h1>
                        <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--public-secondary)]">{subtitle}</p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <ButtonLink href={href(block, "primaryCtaHref", "/booking")}>{primaryLabel}</ButtonLink>
                            <ButtonLink href={href(block, "secondaryCtaHref", "/services#system-map")} secondary>{secondaryLabel}</ButtonLink>
                        </div>
                        {showCommercial ? <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--public-subtle)]">
                            {text(block, "commercialLine", locale, "Foundation €3,900 + €249/month · Growth €7,500 + €699/month · excl. VAT, external services, and metered AI.")}
                        </p> : null}
                    </div>
                    {showEvidence ? <div className="isystem-public-evidence isystem-public-hero-evidence relative overflow-hidden p-6 sm:p-8" data-public-hero-evidence>
                        <div className="absolute inset-x-0 top-0 h-1 bg-[var(--public-brass)]" />
                        <p className="isystem-public-eyebrow">{text(block, "evidenceEyebrow", locale, "The operating question")}</p>
                        <div className="isystem-public-signal-map" aria-hidden="true">
                            {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
                        </div>
                        <p className="mt-5 font-[var(--public-font-display)] text-2xl font-semibold leading-tight text-[var(--public-ink)]">
                            {text(block, "evidenceTitle", locale, "Can the next buyer, the next delivery step, and the next decision see the same system?")}
                        </p>
                        <div className="mt-8 border-t border-[var(--public-line)] pt-5 text-sm leading-6 text-[var(--public-secondary)]">
                            {text(block, "evidenceDescription", locale, "The public site is the first visible layer: outcome first, evidence second, tool names only when they help a buyer understand the work.")}
                        </div>
                    </div> : null}
                </div>
            </Container>
        </Section>
    );
}

function ProblemRecognition({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    const points = Array.isArray(prop(block, "points")) ? prop(block, "points") as unknown[] : [];
    const fallback = defaultItems("ProblemRecognition", "points");
    return (
        <Section className="bg-[var(--public-paper)]">
            <Container>
                <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
                    <div>
                        <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, "Recognition")}</p>
                        <h2 className="isystem-public-title mt-4">{text(block, "title", locale, "The problem is rarely one missing tool.")}</h2>
                    </div>
                    <div className="grid gap-0 divide-y divide-[var(--public-line)] border-y border-[var(--public-line)]">
                        {(points.length > 0 ? points : fallback).map((point, index) => {
                            const fallbackPoint = fallback[index] ?? fallback[fallback.length - 1];
                            return <div className="isystem-public-list-row grid gap-4 py-5 sm:grid-cols-[3rem_1fr]" data-public-step key={index}>
                                <span className="font-mono text-sm text-[var(--public-brass)]">0{index + 1}</span>
                                <p className="text-lg leading-8 text-[var(--public-secondary)]">{localizedItem(point, "text", locale, localizedItem(fallbackPoint, "text", locale))}</p>
                            </div>;
                        })}
                    </div>
                </div>
            </Container>
        </Section>
    );
}

function SystemMap({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    return (
        <Section id="system-map" className="bg-[var(--public-soft)]">
            <Container>
                <div className="max-w-3xl">
                    <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, "The system map")}</p>
                    <h2 className="isystem-public-title mt-4">{text(block, "title", locale, "Five connected systems. One accountable operating layer.")}</h2>
                    <p className="mt-5 text-lg leading-8 text-[var(--public-secondary)]">{text(block, "description", locale, "The work is organized around buyer outcomes and operating loops, not around a catalogue of software features.")}</p>
                </div>
                <div className="isystem-public-system-network mt-12 grid overflow-hidden rounded-[var(--public-radius-lg)] border border-[var(--public-line)] lg:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)]">
                    <aside className="isystem-public-system-hub" data-public-card>
                        <div>
                            <p className="isystem-public-eyebrow !text-[var(--public-brass)]">{localeText(locale, "Managed operating layer", "Beheerde operationele laag", "طبقة تشغيل مُدارة")}</p>
                            <p className="mt-5 max-w-sm text-2xl leading-tight text-white">{localeText(locale, "One workspace keeps ownership, evidence, and the next decision visible.", "Eén werkruimte houdt eigenaarschap, bewijs en de volgende beslissing zichtbaar.", "تحافظ مساحة عمل واحدة على وضوح الملكية والدليل والقرار التالي.")}</p>
                        </div>
                        <div className="isystem-public-system-orbit" aria-hidden="true">
                            <span className="isystem-public-system-orbit-core">iS</span>
                            {ISYSTEM_PUBLIC_SYSTEMS.map((system, index) => <span className="isystem-public-system-orbit-node" key={system.id}>{index + 1}</span>)}
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t border-[var(--public-inverse-line)] pt-5">
                            <div><strong className="block text-3xl text-white">05</strong><span className="mt-1 block text-xs text-white/50">{localeText(locale, "connected systems", "verbonden systemen", "أنظمة مترابطة")}</span></div>
                            <div><strong className="block text-3xl text-white">01</strong><span className="mt-1 block text-xs text-white/50">{localeText(locale, "accountable layer", "verantwoordelijke laag", "طبقة مسؤولة")}</span></div>
                        </div>
                    </aside>
                    <div className="isystem-public-system-stack bg-[var(--public-paper)]">
                        {ISYSTEM_PUBLIC_SYSTEMS.map((system, index) => (
                            <article className="isystem-public-system-row" data-public-card key={system.id} id={system.id}>
                                <span className="isystem-public-system-row-index">0{index + 1}</span>
                                <div className="min-w-0">
                                    <h3 className="text-xl leading-tight">{localized(system.label, locale)}</h3>
                                    <p className="mt-2 text-sm leading-6 text-[var(--public-secondary)]">{localized(system.description, locale)}</p>
                                </div>
                                <ul className="isystem-public-system-row-capabilities">
                                    {ISYSTEM_PUBLIC_CAPABILITIES
                                        .filter((capability) => capability.systemId === system.id && capability.status !== "roadmap")
                                        .slice(0, 3)
                                        .map((capability) => <li key={capability.id}>{localized(capability.label, locale)}</li>)}
                                </ul>
                                <span className="isystem-public-system-row-arrow" aria-hidden="true">&#8594;</span>
                            </article>
                        ))}
                    </div>
                </div>
            </Container>
        </Section>
    );
}

function ServiceArchitecture({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    return (
        <Section id="system-map" className="bg-[var(--public-soft)]">
            <Container>
                <div className="max-w-3xl">
                    <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, localeText(locale, "Five connected systems", "Vijf verbonden systemen", "خمسة أنظمة مترابطة"))}</p>
                    <h2 className="isystem-public-title mt-4">{text(block, "title", locale, localeText(locale, "Every service belongs to one operating system.", "Elke dienst hoort bij één operationeel systeem.", "تنتمي كل خدمة إلى نظام تشغيل واحد."))}</h2>
                    <p className="mt-5 text-lg leading-8 text-[var(--public-secondary)]">{text(block, "description", locale, localeText(
                        locale,
                        "The groups below cover the complete public service scope. Status is stated separately so a configured or assisted workflow is never presented as autonomous software.",
                        "De groepen hieronder dekken de volledige publieke scope. De status staat apart, zodat ingericht of ondersteund werk nooit als autonome software wordt verkocht.",
                        "تغطي المجموعات أدناه النطاق العام الكامل للخدمات. وتُعرض الحالة منفصلة حتى لا يُقدَّم التدفق المهيأ أو المدعوم بوصفه برنامجًا ذاتيًا.",
                    ))}</p>
                </div>
                <div className="mt-12 grid gap-4 lg:grid-cols-2">
                    {ISYSTEM_PUBLIC_SYSTEMS.map((system, index) => {
                        const capabilities = ISYSTEM_PUBLIC_CAPABILITIES.filter(
                            (capability) => capability.systemId === system.id && capability.status !== "roadmap",
                        );
                        return (
                            <article className={`isystem-public-service-row rounded-[var(--public-radius-lg)] border border-[var(--public-line)] bg-[var(--public-paper)] p-6 sm:p-8 ${index === ISYSTEM_PUBLIC_SYSTEMS.length - 1 ? "lg:col-span-2" : ""}`} data-public-card id={system.id} key={system.id}>
                                <div>
                                    <span className="font-mono text-xs text-[var(--public-brass)]">0{index + 1}</span>
                                    <h3 className="mt-5 text-2xl leading-tight">{localized(system.label, locale)}</h3>
                                    <p className="mt-3 text-sm leading-6 text-[var(--public-secondary)]">{localized(system.description, locale)}</p>
                                </div>
                                <div className="mt-6 divide-y divide-[var(--public-line)] border-y border-[var(--public-line)]">
                                    {capabilities.map((capability) => (
                                        <details className="isystem-public-service-capability py-3.5" key={capability.id}>
                                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 marker:hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--public-action)]">
                                                <h4 className="font-semibold leading-6 text-[var(--public-ink)]">{localized(capability.label, locale)}</h4>
                                                <span className="flex shrink-0 items-center gap-2">
                                                    <span className="text-xs font-semibold text-[var(--public-action-strong)]">{capabilityStatusLabel(capability.status, locale)}</span>
                                                    <span className="isystem-public-service-plus text-lg leading-none text-[var(--public-brass)]" aria-hidden="true">+</span>
                                                </span>
                                            </summary>
                                            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--public-secondary)]">{localized(capability.publicDescription, locale)}</p>
                                        </details>
                                    ))}
                                </div>
                            </article>
                        );
                    })}
                </div>
            </Container>
        </Section>
    );
}

function ScopeBoundary({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    return (
        <Section className="bg-[var(--public-canvas)]">
            <Container>
                <div className="max-w-3xl">
                    <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, localeText(locale, "Scope and boundaries", "Scope en grenzen", "النطاق والحدود"))}</p>
                    <h2 className="isystem-public-title mt-4">{text(block, "title", locale, localeText(locale, "Know what is included before the work begins.", "Weet vóór de start wat wel en niet is inbegrepen.", "اعرف ما هو مشمول قبل بدء العمل."))}</h2>
                    <p className="mt-5 text-lg leading-8 text-[var(--public-secondary)]">{text(block, "description", locale, localeText(
                        locale,
                        "The offer stays understandable by separating the managed systems, separately scoped work, and the promises iSystem deliberately does not make.",
                        "Het aanbod blijft begrijpelijk door beheerde systemen, apart werk en bewuste grenzen van elkaar te scheiden.",
                        "يبقى العرض واضحًا عبر فصل الأنظمة المُدارة والعمل ذي النطاق المنفصل والوعود التي يتعمد iSystem عدم تقديمها.",
                    ))}</p>
                </div>
                <div className="isystem-public-scope-grid mt-12 grid gap-4 lg:grid-cols-12">
                    {ISYSTEM_PUBLIC_SCOPE_COLUMNS.map((column, index) => (
                        <article className={`isystem-public-scope-card relative overflow-hidden rounded-[var(--public-radius-lg)] border p-6 sm:p-8 ${index % 4 === 0 || index % 4 === 3 ? "lg:col-span-5" : "lg:col-span-7"} ${column.id === "boundary" ? "border-[var(--public-navy)] bg-[var(--public-navy)] text-white" : "border-[var(--public-line)] bg-[var(--public-paper)]"}`} data-public-card id={column.id === "embedded" ? "embedded" : undefined} key={column.id}>
                            <div className="flex items-start justify-between gap-6">
                                <p className={`isystem-public-eyebrow ${column.id === "boundary" ? "!text-[var(--public-brass)]" : ""}`}>{localized(column.label, locale)}</p>
                                <span className={`isystem-public-scope-index font-mono text-xs ${column.id === "boundary" ? "text-white/50" : "text-[var(--public-subtle)]"}`} aria-hidden="true">0{index + 1}</span>
                            </div>
                            <p className={`mt-5 max-w-2xl text-base leading-7 ${column.id === "boundary" ? "text-white/70" : "text-[var(--public-secondary)]"}`}>{localized(column.description, locale)}</p>
                            <ul className={`mt-6 space-y-3 border-t pt-5 text-sm leading-6 ${column.id === "boundary" ? "border-[var(--public-inverse-line)] text-white" : "border-[var(--public-line)] text-[var(--public-ink)]"}`}>
                                {column.items.map((item) => (
                                    <li className="flex gap-2" key={item.en}>
                                        <span className="mt-[0.58rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--public-brass)]" aria-hidden="true" />
                                        <span>{localized(item, locale)}</span>
                                    </li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </div>
            </Container>
        </Section>
    );
}

function OperatingLoop({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    const steps = Array.isArray(prop(block, "steps")) ? prop(block, "steps") as unknown[] : [];
    const fallback = defaultItems("OperatingLoop", "steps");
    const loopSteps = steps.length > 0 ? steps : fallback;
    return (
        <Section className="isystem-public-operating-loop isystem-public-proof-surface">
            <Container>
                <div className="isystem-public-loop-header grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.7fr)] lg:items-end">
                    <div className="max-w-4xl">
                        <p className="isystem-public-eyebrow !text-[var(--public-brass)]">{text(block, "eyebrow", locale, "Working proof")}</p>
                        <h2 className="isystem-public-title mt-4 text-white">{text(block, "title", locale, "A visible chain from evidence to delivery.")}</h2>
                    </div>
                    <p className="max-w-xl text-base leading-7 text-white/70 lg:justify-self-end">{text(block, "description", locale, localeText(
                        locale,
                        "Every stage leaves evidence for the next one, so growth and delivery stay reviewable instead of disappearing into disconnected tools.",
                        "Elke fase laat bewijs achter voor de volgende, zodat groei en levering controleerbaar blijven in plaats van te verdwijnen in losse tools.",
                        "تترك كل مرحلة دليلًا للمرحلة التالية، لتظل عمليات النمو والتسليم قابلة للمراجعة بدلًا من التشتت بين أدوات منفصلة.",
                    ))}</p>
                </div>
                <div className="isystem-public-loop-panel mt-10" data-public-card>
                    <div className="isystem-public-loop-panel-header">
                        <span>{localeText(locale, "Operating route", "Operationele route", "مسار التشغيل")}</span>
                        <span><strong>01</strong> {localeText(locale, "reviewed", "beoordeeld", "مراجَع")} <span aria-hidden="true">&#8594;</span> <strong>05</strong> {localeText(locale, "recorded", "vastgelegd", "موثّق")}</span>
                    </div>
                    <ol className="isystem-public-loop-grid">
                        {loopSteps.map((step, index) => {
                            const fallbackStep = asRecord(fallback[index] ?? fallback[fallback.length - 1]);
                            return (
                                <li className="isystem-public-loop-step" data-public-step key={index}>
                                    <div className="isystem-public-loop-node" aria-hidden="true"><span>0{index + 1}</span></div>
                                    <div className="isystem-public-loop-card">
                                        <p className="isystem-public-loop-stage">{localizedItem(step, "stage", locale, localized(fallbackStep.stage as LocalizedValue, locale))}</p>
                                        <h3>{localizedItem(step, "label", locale, localized(fallbackStep.label as LocalizedValue, locale))}</h3>
                                        <p>{localizedItem(step, "description", locale, localized(fallbackStep.description as LocalizedValue, locale))}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </Container>
        </Section>
    );
}

function OfferComparison({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    const offers = [ISYSTEM_COMMERCIAL_OFFER.foundation, ISYSTEM_COMMERCIAL_OFFER.growth];
    const includedScope = [
        ISYSTEM_PUBLIC_SCOPE_COLUMNS.find((column) => column.id === "foundation"),
        ISYSTEM_PUBLIC_SCOPE_COLUMNS.find((column) => column.id === "growth"),
    ];
    const offerLabels = [
        { en: "Foundation", nl: "Basis", ar: "التأسيس" },
        { en: "Growth", nl: "Groei", ar: "النمو" },
    ] as const;
    const offerIds = ["foundation", "growth"] as const;
    return (
        <Section id="offers" className="bg-[var(--public-paper)]">
            <Container>
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                    <div className="max-w-3xl">
                        <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, "The offer")}</p>
                        <h2 className="isystem-public-title mt-4">{text(block, "title", locale, "Choose the operating shape that matches the work.")}</h2>
                        <p className="mt-5 text-lg leading-8 text-[var(--public-secondary)]">{text(block, "description", locale, "Start with a Fit Call. Use a Blueprint when the system needs to be mapped before implementation.")}</p>
                    </div>
                    <ButtonLink href="/booking" secondary>{text(block, "fitCallLabel", locale, "Start with the free Fit Call")}</ButtonLink>
                </div>
                <div className="mt-12 grid gap-5 lg:grid-cols-2">
                    {offers.map((offer, index) => {
                        const scope = includedScope[index];
                        return (
                        <article className={`isystem-public-offer-card isystem-public-offer-tier relative overflow-hidden rounded-[var(--public-radius-lg)] border p-7 sm:p-9 ${index === 1 ? "border-[var(--public-action)] bg-[var(--public-navy)] text-white" : "border-[var(--public-line)] bg-[var(--public-canvas)]"}`} data-public-card key={offer.name} id={index === 0 ? "foundation" : "growth"}>
                            <div className="flex items-start justify-between gap-5">
                                <div>
                                    <p className={`isystem-public-eyebrow ${index === 1 ? "!text-[var(--public-brass)]" : ""}`}><span className="me-3 font-mono" aria-hidden="true">0{index + 1}</span>{localized(offerLabels[index], locale)}</p>
                                    <h3 className={`mt-3 text-3xl ${index === 1 ? "text-white" : ""}`}>{getIsystemPublicOfferName(offerIds[index], locale)}</h3>
                                </div>
                                {index === 1 && <span className="isystem-public-offer-badge">{text(block, "recommendedLabel", locale, "For a broader operating loop")}</span>}
                            </div>
                            <p className={`isystem-public-offer-price mt-8 font-semibold tracking-tight ${index === 1 ? "text-white" : "text-[var(--public-ink)]"}`}>
                                {formatCommercialPrice(offer.setupPriceEur, locale)} <span className={`text-base font-normal ${index === 1 ? "text-white/70" : "text-[var(--public-secondary)]"}`}>{localeText(locale, "setup", "eenmalig", "إعداد")}</span>
                            </p>
                            <div className={`mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm ${index === 1 ? "text-white/70" : "text-[var(--public-secondary)]"}`}>
                                <span><strong className={index === 1 ? "text-white" : "text-[var(--public-ink)]"}>{formatCommercialPrice(offer.monthlyPriceEur, locale)}</strong>/{localeText(locale, "month", "maand", "شهريًا")}</span>
                                <span><strong className={index === 1 ? "text-white" : "text-[var(--public-ink)]"}>{offer.deliveryBusinessDays}</strong> {localeText(locale, "business days", "werkdagen", "يوم عمل")}</span>
                            </div>
                            <div className={`mt-7 border-t pt-6 text-sm leading-7 ${index === 1 ? "border-[var(--public-inverse-line)] text-white/75" : "border-[var(--public-line)] text-[var(--public-secondary)]"}`}>
                                {text(block, index === 0 ? "foundationDescription" : "growthDescription", locale)}
                            </div>
                            {scope ? <ul className={`isystem-public-offer-inclusions mt-6 grid gap-3 border-t pt-6 text-sm leading-6 sm:grid-cols-2 ${index === 1 ? "border-[var(--public-inverse-line)] text-white/80" : "border-[var(--public-line)] text-[var(--public-ink)]"}`}>
                                {scope.items.map((item) => <li className="flex gap-2" key={item.en}><span aria-hidden="true" />{localized(item, locale)}</li>)}
                            </ul> : null}
                        </article>
                        );
                    })}
                </div>
                <div className="mt-7 grid gap-4 border-t border-[var(--public-line)] pt-7 text-sm leading-6 text-[var(--public-secondary)] sm:grid-cols-3">
                    <p id="blueprint"><strong className="text-[var(--public-ink)]">{localeText(locale, "Systems Blueprint.", "Systeemplan.", "مخطط الأنظمة.")}</strong> {localeText(locale, "€490 · 90 minutes · credited to implementation within 30 days.", "€490 · 90 minuten · binnen 30 dagen verrekend met implementatie.", "€490 · 90 دقيقة · تُخصم من التنفيذ خلال 30 يومًا.")}</p>
                    <p id="embedded"><strong className="text-[var(--public-ink)]">{localeText(locale, "Embedded Systems Engagement.", "Embedded systeemtraject.", "تعاون أنظمة مدمج.")}</strong> {localeText(locale, "Proposal-only when the operating scope requires it.", "Alleen op voorstel wanneer de operationele scope dat vraagt.", "بعرض مستقل عندما يتطلب نطاق التشغيل ذلك.")}</p>
                    <p>{localized(ISYSTEM_PUBLIC_OFFER_NOTES.vatExclusion, locale)}</p>
                </div>
            </Container>
        </Section>
    );
}

function MethodTimeline({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    const steps = Array.isArray(prop(block, "steps")) ? prop(block, "steps") as unknown[] : [];
    const fallback = defaultItems("MethodTimeline", "steps");
    return (
        <Section className="bg-[var(--public-soft)]">
            <Container>
                <div className="max-w-2xl">
                    <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, "The method")}</p>
                    <h2 className="isystem-public-title mt-4">{text(block, "title", locale, "A small number of decisions, made in the right order.")}</h2>
                </div>
                <div className="isystem-public-method-grid mt-12 grid gap-4 lg:grid-cols-3">
                    {(steps.length > 0 ? steps : fallback).map((step, index) => {
                        const values = Array.isArray(step) ? step : [String(index + 1).padStart(2, "0"), asRecord(step).title, asRecord(step).description];
                        const fallbackValues = Array.isArray(fallback[index]) ? fallback[index] as unknown[] : [];
                        return <article className="isystem-public-method-step relative overflow-hidden rounded-[var(--public-radius-lg)] border border-[var(--public-line)] bg-[var(--public-paper)] p-6 sm:p-8" data-public-step key={index}>
                            <div className="flex items-center justify-between gap-4">
                                <span className="isystem-public-method-number font-mono text-sm text-[var(--public-brass)]">{String(values[0] ?? `0${index + 1}`)}</span>
                                <span className="isystem-public-method-phase">{[
                                    localeText(locale, "Decide", "Beslissen", "قرار"),
                                    localeText(locale, "Map", "Uitwerken", "تخطيط"),
                                    localeText(locale, "Operate", "Uitvoeren", "تشغيل"),
                                ][index] ?? localeText(locale, "Review", "Review", "مراجعة")}</span>
                            </div>
                            <h3 className="mt-12 text-2xl">{localized(values[1] as LocalizedValue, locale, localized(fallbackValues[1] as LocalizedValue, locale, localeText(locale, "Step", "Stap", "خطوة")))}</h3>
                            <p className="mt-4 text-base leading-7 text-[var(--public-secondary)]">{localized(values[2] as LocalizedValue, locale, localized(fallbackValues[2] as LocalizedValue, locale))}</p>
                            <span className="isystem-public-method-arrow" aria-hidden="true">&#8594;</span>
                        </article>;
                    })}
                </div>
            </Container>
        </Section>
    );
}

function FeatureStatusMatrix({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    const requestedCapabilityIds = Array.isArray(prop(block, "capabilityIds"))
        ? (prop(block, "capabilityIds") as unknown[]).filter((id): id is string => typeof id === "string")
        : [];
    const blockId = typeof prop(block, "id") === "string" ? prop(block, "id") as string : "";
    const defaultCapabilityIds: Record<string, string[]> = {
        "home-capability-status": [
            "public-presence",
            "content-studio",
            "seo-control-center",
            "newsletter-lifecycle",
            "booking-checkout",
            "opportunity-and-market-signals",
            "ai-assisted-workflows",
            "legal-vault",
        ],
        "about-status": [
            "ai-assisted-workflows",
            "gdpr-consent-controls",
            "legal-vault",
            "bookkeeping-commercial-ops",
            "multilingual-public-site",
            "partner-portal",
        ],
    };
    const capabilityIds = requestedCapabilityIds.length > 0
        ? requestedCapabilityIds
        : defaultCapabilityIds[blockId] ?? [];
    const capabilities = capabilityIds.length > 0
        ? capabilityIds.flatMap((id) => {
            const capability = ISYSTEM_PUBLIC_CAPABILITIES.find((candidate) => candidate.id === id);
            return capability ? [capability] : [];
        })
        : ISYSTEM_PUBLIC_CAPABILITIES.filter((capability) => capability.status !== "roadmap" || prop(block, "showRoadmap") === true);
    return (
        <Section className="bg-[var(--public-canvas)]">
            <Container>
                <div className="max-w-3xl">
                    <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, "Capability status")}</p>
                    <h2 className="isystem-public-title mt-4">{text(block, "title", locale, "What is shipped, configured, assisted, or still ahead.")}</h2>
                </div>
                <div className="isystem-public-capability-ledger mt-10 overflow-hidden rounded-[var(--public-radius-lg)] border border-[var(--public-line)] bg-[var(--public-paper)]">
                    <div className="isystem-public-capability-ledger-header">
                        <span>{String(capabilities.length).padStart(2, "0")} {localeText(locale, "capabilities", "onderdelen", "قدرات")}</span>
                        <span>{localeText(locale, "Status and boundary stay visible", "Status en grens blijven zichtbaar", "تظل الحالة والحدود واضحة")}</span>
                    </div>
                    <div className="isystem-public-capability-grid">
                        {capabilities.map((capability, index) => (
                            <article className="isystem-public-status-row isystem-public-capability-item" data-public-step key={capability.id}>
                                <div className="flex items-start justify-between gap-4">
                                    <span className="isystem-public-capability-index">{String(index + 1).padStart(2, "0")}</span>
                                    <span className={`isystem-public-capability-status ${capability.status === "shipped" ? "is-shipped" : capability.status === "roadmap" ? "is-roadmap" : "is-assisted"}`}>
                                        <span aria-hidden="true" />{capabilityStatusLabel(capability.status, locale)}
                                    </span>
                                </div>
                                <h3 className="mt-5 text-lg">{localized(capability.label, locale)}</h3>
                                <p className="mt-2 text-sm leading-6 text-[var(--public-secondary)]">{localized(capability.publicDescription, locale)}</p>
                                <p className="isystem-public-capability-boundary"><strong>{localeText(locale, "Boundary", "Grens", "الحدود")}</strong>{localized(capability.limitation, locale, capability.status === "shipped"
                                    ? localeText(locale, "Available within the agreed service scope.", "Beschikbaar binnen de afgesproken servicescope.", "متاح ضمن نطاق الخدمة المتفق عليه.")
                                    : localeText(locale, "Configured or assisted within the agreed scope.", "Ingericht of ondersteund binnen de afgesproken scope.", "مهيأ أو مدعوم ضمن النطاق المتفق عليه."))}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </Container>
        </Section>
    );
}

function FounderWorkingModel({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    return (
        <Section className="bg-[var(--public-paper)]">
            <Container>
                <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
                    <div>
                        <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, "Founder working model")}</p>
                        <h2 className="isystem-public-title mt-4">{text(block, "title", locale, "The person who designed the system is accountable for the work.")}</h2>
                    </div>
                    <div className="border-l-2 border-[var(--public-brass)] pl-6 text-lg leading-8 text-[var(--public-secondary)]">
                        {text(block, "description", locale, "iSystem is founder-led by Hossam Afifi from Breda. The relationship is direct, the system is governed, and the boundary between what is shipped and what is still being built remains visible.")}
                    </div>
                </div>
            </Container>
        </Section>
    );
}

function FitAndNonFit({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    return (
        <Section className="bg-[var(--public-soft)]">
            <Container>
                <div className="grid gap-px overflow-hidden rounded-[var(--public-radius-lg)] border border-[var(--public-line)] bg-[var(--public-line)] md:grid-cols-2">
                    <div className="isystem-public-fit-card bg-[var(--public-paper)] p-7 sm:p-10" data-public-card>
                        <p className="isystem-public-eyebrow">{text(block, "fitEyebrow", locale, "Good fit")}</p>
                        <h2 className="mt-4 text-3xl">{text(block, "fitTitle", locale, "Owner-led Dutch service firms that need the operation to become legible.")}</h2>
                        <p className="mt-5 text-base leading-7 text-[var(--public-secondary)]">{text(block, "fitDescription", locale, "Usually 5–30 people, with real expertise, disconnected tools, and an owner willing to review evidence and make decisions.")}</p>
                    </div>
                    <div className="isystem-public-fit-card bg-[var(--public-navy)] p-7 text-white sm:p-10" data-public-card>
                        <p className="isystem-public-eyebrow !text-[var(--public-brass)]">{text(block, "nonFitEyebrow", locale, "Not a fit")}</p>
                        <h2 className="mt-4 text-3xl text-white">{text(block, "nonFitTitle", locale, "Not a cheap brochure site, an unmetered AI sandbox, or a 24/7 enterprise delivery team.")}</h2>
                        <p className="mt-5 text-base leading-7 text-white/75">{text(block, "nonFitDescription", locale, "The system works when there is an accountable owner, a defined outcome, and enough evidence to improve the next decision.")}</p>
                    </div>
                </div>
            </Container>
        </Section>
    );
}

function QuestionAccordion({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    const items = Array.isArray(prop(block, "items")) ? prop(block, "items") as unknown[] : [];
    const fallback = defaultItems("QuestionAccordion", "items");
    return (
        <Section className="bg-[var(--public-paper)]">
            <Container>
                <div className="mx-auto max-w-3xl">
                    <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, "Questions")}</p>
                    <h2 className="isystem-public-title mt-4">{text(block, "title", locale, "Clear before commercial.")}</h2>
                    <div className="mt-10 divide-y divide-[var(--public-line)] border-y border-[var(--public-line)]">
                        {(items.length > 0 ? items : fallback).map((item, index) => {
                            const record = Array.isArray(item) ? { question: item[0], answer: item[1] } : asRecord(item);
                            const fallbackRecord = asRecord(fallback[index] ?? fallback[fallback.length - 1]);
                            return <details className="isystem-public-question group py-5" data-public-step key={index}>
                                <summary className="cursor-pointer list-none pr-8 text-lg font-semibold text-[var(--public-ink)] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--public-action)]">{localized(record.question as LocalizedValue, locale, localized(fallbackRecord.question as LocalizedValue, locale))}</summary>
                                <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--public-secondary)]">{localized(record.answer as LocalizedValue, locale, localized(fallbackRecord.answer as LocalizedValue, locale))}</p>
                            </details>;
                        })}
                    </div>
                </div>
            </Container>
        </Section>
    );
}

function FinalDecisionCta({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    return (
        <Section className="isystem-public-final isystem-public-proof-surface">
            <Container>
                <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div className="max-w-3xl">
                        <p className="isystem-public-eyebrow !text-[var(--public-brass)]">{text(block, "eyebrow", locale, "The next decision")}</p>
                        <h2 className="isystem-public-title mt-4 text-white">{text(block, "title", locale, "Start with the question the system needs to answer.")}</h2>
                        <p className="mt-5 text-lg leading-8 text-white/75">{text(block, "description", locale, "Book a free 30-minute Systems Fit Call with Hossam. No free audit, report, or implementation work is implied.")}</p>
                    </div>
                    <ButtonLink href={href(block, "href", "/booking")}>{text(block, "label", locale, "Book the free Systems Fit Call")}</ButtonLink>
                </div>
            </Container>
        </Section>
    );
}

function ContactExperience({ block, locale, templateId }: { block: PublicPagePuckBlock; locale: Locale; templateId?: string }) {
    return (
        <Section className="bg-[var(--public-paper)]">
            <Container>
                <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
                    <div>
                        <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, "Fit first")}</p>
                        <h2 className="isystem-public-title mt-4">{text(block, "title", locale, localeText(locale, "One conversation before any proposal.", "Eén gesprek vóór ieder voorstel.", "محادثة واحدة قبل أي عرض."))}</h2>
                    </div>
                    <div className="isystem-public-contact-decision isystem-public-evidence overflow-hidden p-7 sm:p-9">
                        <div className="flex items-center justify-between gap-5 border-b border-[var(--public-line)] pb-5">
                            <span className="isystem-public-eyebrow">{localeText(locale, "Qualification path", "Kwalificatieroute", "مسار التأهيل")}</span>
                            <span className="font-mono text-xs text-[var(--public-subtle)]">{localeText(locale, "30 MIN · FREE", "30 MIN · GRATIS", "30 دقيقة · مجانًا")}</span>
                        </div>
                        <p className="text-lg leading-8 text-[var(--public-secondary)]">{text(block, "description", locale, "The free Systems Fit Call is the qualification step. If the decision needs a written system map, the next step is the Systems Blueprint.")}</p>
                        <div className="isystem-public-contact-steps mt-7 grid gap-px overflow-hidden rounded-[var(--public-radius-md)] border border-[var(--public-line)] bg-[var(--public-line)] sm:grid-cols-2">
                            <div className="bg-[var(--public-canvas)] p-5">
                                <span className="font-mono text-xs text-[var(--public-brass)]">01</span>
                                <h3 className="mt-4 text-lg">{localeText(locale, "Systems Fit Call", "Systems Fit Call", "مكالمة ملاءمة الأنظمة")}</h3>
                                <p className="mt-2 text-sm leading-6 text-[var(--public-secondary)]">{localeText(locale, "Clarify the outcome, current setup, and mutual fit.", "Verhelder het doel, de huidige situatie en de wederzijdse fit.", "وضّح النتيجة والوضع الحالي والملاءمة المتبادلة.")}</p>
                            </div>
                            <div className="bg-[var(--public-soft)] p-5">
                                <span className="font-mono text-xs text-[var(--public-brass)]">02</span>
                                <h3 className="mt-4 text-lg">{localeText(locale, "Blueprint when needed", "Blueprint wanneer nodig", "مخطط عند الحاجة")}</h3>
                                <p className="mt-2 text-sm leading-6 text-[var(--public-secondary)]">{localeText(locale, "Map the system only when the decision needs written detail.", "Breng het systeem alleen in kaart wanneer de beslissing schriftelijk detail vraagt.", "ارسم النظام فقط عندما يحتاج القرار إلى تفاصيل مكتوبة.")}</p>
                            </div>
                        </div>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <ButtonLink href="/booking">{text(block, "primaryLabel", locale, "Book the free Fit Call")}</ButtonLink>
                        </div>
                        {templateId ? (
                            <div className="mt-10 border-t border-[var(--public-line)] pt-8">
                                <h3 className="text-2xl">{localeText(locale, "Prefer to write first?", "Liever eerst schrijven?", "هل تفضل الكتابة أولًا؟")}</h3>
                                <p className="mt-3 text-sm leading-6 text-[var(--public-secondary)]">
                                    {localeText(
                                        locale,
                                        "Send an inquiry and receive an acknowledgement. Marketing requires the separate optional checkbox.",
                                        "Stuur een aanvraag en ontvang een ontvangstbevestiging. Marketing vereist het aparte optionele selectievakje.",
                                        "أرسل طلبًا واحصل على تأكيد. يتطلب التسويق تحديد مربع اختياري منفصل.",
                                    )}
                                </p>
                                <PublicContactForm locale={locale} templateId={templateId} />
                            </div>
                        ) : null}
                    </div>
                </div>
            </Container>
        </Section>
    );
}

function FoundationBlock({ block, locale, mode }: { block: PublicPagePuckBlock; locale: Locale; mode: PublicPageRenderMode }) {
    if (block.type === "Rule") {
        return <hr className="isystem-public-container border-[var(--public-line)]" aria-label={text(block, "label", locale, localeText(locale, "Section divider", "Sectiescheiding", "فاصل القسم"))} />;
    }
    if (block.type === "Spacer") {
        const height = prop(block, "height") === "lg" ? "h-32" : prop(block, "height") === "sm" ? "h-8" : prop(block, "height") === "xl" ? "h-48" : "h-16";
        return <div className={height} aria-hidden="true" />;
    }
    if (block.type === "SurfaceBand") {
        return <div className="border-y border-[var(--public-line)] bg-[var(--public-soft)] py-8" />;
    }
    if (mode === "published") return null;
    return (
        <Section className="bg-[var(--public-canvas)]">
            <Container>
                <div className="isystem-public-evidence p-7 sm:p-9">
                    <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, "Layout preview")}</p>
                    <h2 className="mt-4 text-3xl">{text(block, "title", locale, "Structural section")}</h2>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--public-secondary)]">{text(block, "description", locale, "This structural block is visible only while editing.")}</p>
                </div>
            </Container>
        </Section>
    );
}

function EvidenceBlock({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    const title = text(block, "title", locale, localeText(locale, "What can be checked.", "Wat controleerbaar is.", "ما يمكن التحقق منه."));
    const description = text(block, "description", locale, localeText(locale, "Evidence is presented with its context, date, current status, and limits.", "Bewijs wordt getoond met context, datum, actuele status en grenzen.", "يُعرض الدليل مع سياقه وتاريخه وحالته الحالية وحدوده."));
    return (
        <Section className="bg-[var(--public-soft)]">
            <Container>
                <div className="isystem-public-evidence grid gap-6 p-7 sm:p-9 lg:grid-cols-[0.8fr_1.2fr]">
                    <div>
                        <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, localeText(locale, "Evidence", "Bewijs", "الدليل"))}</p>
                        <h2 className="mt-4 text-3xl">{title}</h2>
                    </div>
                    <p className="text-lg leading-8 text-[var(--public-secondary)]">{description}</p>
                </div>
            </Container>
        </Section>
    );
}

function DataBoundBlock({ block, locale, mode, snapshot }: { block: PublicPagePuckBlock; locale: Locale; mode: PublicPageRenderMode; snapshot?: PublicDataSnapshot }) {
    const status = snapshot?.status ?? "unavailable";
    if (mode === "published" && (status === "unavailable" || status === "error")) return null;
    const title = text(block, "title", locale, localeText(locale, "Published work", "Gepubliceerd werk", "الأعمال المنشورة"));
    const message = snapshot?.message ?? (status === "unavailable"
        ? localeText(locale, "This collection is not connected in preview.", "Deze collectie is niet gekoppeld in de preview.", "هذه المجموعة غير متصلة في المعاينة.")
        : status === "empty" ? localeText(locale, "New work is being prepared.", "Nieuw werk wordt voorbereid.", "يجري إعداد أعمال جديدة.") : localeText(locale, "The published collection is available.", "De gepubliceerde collectie is beschikbaar.", "المجموعة المنشورة متاحة."));
    return (
        <Section className="bg-[var(--public-paper)]">
            <Container>
                <div className="isystem-public-evidence p-7 sm:p-9">
                    <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, localeText(locale, "Published", "Gepubliceerd", "منشور"))}</p>
                    <h2 className="mt-4 text-3xl">{title}</h2>
                    <p className="mt-4 text-base leading-7 text-[var(--public-secondary)]">{message}</p>
                    {status === "error" ? <p className="mt-3 text-sm font-semibold text-[var(--public-danger)]">{snapshot?.message ?? localeText(locale, "The collection could not be loaded.", "De collectie kon niet worden geladen.", "تعذر تحميل المجموعة.")}</p> : null}
                </div>
            </Container>
        </Section>
    );
}

function ProtectedBlock({ block, locale }: { block: PublicPagePuckBlock; locale: Locale }) {
    const destination = block.type === "BookingExperience" ? "/booking"
        : block.type === "NewsletterSignup" || block.type === "NewsletterPreferenceAction" ? "/newsletter"
            : block.type === "PublicToolExperience" || block.type === "SharedToolResult" ? "/tools"
                : block.type === "ResourceDownload" ? "/resources"
                    : block.type === "AuthExperience" ? "/login"
                        : "/contact";
    return (
        <Section className="bg-[var(--public-soft)]">
            <Container>
                <div className="isystem-public-evidence flex flex-col gap-6 p-7 sm:flex-row sm:items-end sm:justify-between sm:p-9">
                    <div>
                        <p className="isystem-public-eyebrow">{text(block, "eyebrow", locale, localeText(locale, "Next step", "Volgende stap", "الخطوة التالية"))}</p>
                        <h2 className="mt-4 text-3xl">{text(block, "title", locale, localeText(locale, "Continue when you are ready.", "Ga verder wanneer je klaar bent.", "تابع عندما تكون مستعدًا."))}</h2>
                        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--public-secondary)]">{text(block, "description", locale, localeText(locale, "Open the relevant page to complete this step securely.", "Open de juiste pagina om deze stap veilig af te ronden.", "افتح الصفحة المناسبة لإكمال هذه الخطوة بأمان."))}</p>
                    </div>
                    <ButtonLink href={destination}>{text(block, "label", locale, localeText(locale, "Continue", "Verder", "متابعة"))}</ButtonLink>
                </div>
            </Container>
        </Section>
    );
}

function RenderBlock({ block, locale, mode, templateId, dataSnapshots }: { block: PublicPagePuckBlock; locale: Locale; mode: PublicPageRenderMode; templateId?: string; dataSnapshots?: Record<string, PublicDataSnapshot> }) {
    switch (block.type) {
        case "Section":
        case "Container":
        case "Columns":
        case "Stack":
        case "Rule":
        case "Spacer":
        case "SurfaceBand": return <FoundationBlock block={block} locale={locale} mode={mode} />;
        case "OutcomeHero": return <OutcomeHero block={block} locale={locale} />;
        case "ProblemRecognition": return <ProblemRecognition block={block} locale={locale} />;
        case "SystemMap": return <SystemMap block={block} locale={locale} />;
        case "OperatingLoop": return <OperatingLoop block={block} locale={locale} />;
        case "OfferComparison": return <OfferComparison block={block} locale={locale} />;
        case "MethodTimeline": return <MethodTimeline block={block} locale={locale} />;
        case "FeatureStatusMatrix": return <FeatureStatusMatrix block={block} locale={locale} />;
        case "FounderWorkingModel": return <FounderWorkingModel block={block} locale={locale} />;
        case "FitAndNonFit": return <FitAndNonFit block={block} locale={locale} />;
        case "QuestionAccordion": return <QuestionAccordion block={block} locale={locale} />;
        case "FinalDecisionCta": return <FinalDecisionCta block={block} locale={locale} />;
        case "ContactExperience": return <ContactExperience block={block} locale={locale} templateId={templateId} />;
        case "ProductEvidenceWindow":
        case "AnnotatedWorkspaceView":
        case "WorkflowEvidence":
        case "ProofLedger":
        case "OutcomeCaseStudy":
        case "MetricWithMethod":
        case "TrustControlGrid":
        case "SourceMethodology":
        case "DeliveryChangelog":
        case "DemoEvidenceGrid":
            return <EvidenceBlock block={block} locale={locale} />;
        case "ArticleCollection":
        case "PodcastCollection":
        case "VideoCollection":
        case "ResourceCollection":
        case "CaseStudyCollection":
        case "PublicToolCollection":
        case "RelatedContent":
        case "SearchPerformanceEvidence":
            return <DataBoundBlock block={block} locale={locale} mode={mode} snapshot={dataSnapshots?.[block.type]} />;
        case "BookingExperience":
        case "PaymentReturnSummary":
        case "NewsletterSignup":
        case "NewsletterPreferenceAction":
        case "ResourceDownload":
        case "PublicToolExperience":
        case "SharedToolResult":
        case "AuthExperience":
            return <ProtectedBlock block={block} locale={locale} />;
        case "EditorialLead":
            return <ProblemRecognition block={block} locale={locale} />;
        case "ServiceArchitecture": return <ServiceArchitecture block={block} locale={locale} />;
        case "ScopeBoundary": return <ScopeBoundary block={block} locale={locale} />;
        case "SeoSupportBlock":
            return null;
        default:
            return mode === "preview" || mode === "fixture"
                ? <div className="border border-dashed border-[var(--public-warning)] bg-[#FFF8E8] p-4 text-sm text-[var(--public-warning)]">{localeText(locale, "Unsupported public block", "Niet-ondersteund publiek blok", "مكوّن عام غير مدعوم")}: {block.type}</div>
                : null;
    }
}

export function renderPublicPageBlock(
    block: PublicPagePuckBlock,
    locale: Locale = "en",
    mode: PublicPageRenderMode = "preview",
) {
    return <RenderBlock block={block} locale={locale} mode={mode} />;
}

export function PublicPageRenderer({ definition, data, locale, mode, templateId, dataSnapshots, className = "" }: PublicPageRendererProps) {
    const blocks = [
        ...data.content,
        ...Object.values(data.zones ?? {}).flat(),
    ];
    return (
        <div
            className={`isystem-public-renderer ${className}`}
            data-public-page-kind={definition.pageKind}
            data-public-render-mode={mode}
            dir={locale === "ar" ? "rtl" : "ltr"}
        >
            {mode === "published" ? <PublicPageMotionController /> : null}
            {mode === "preview" ? (
                <div className="sticky top-16 z-40 border-b border-[var(--public-warning)] bg-[#FFF8E8] px-4 py-2 text-center text-xs font-semibold text-[var(--public-warning)]" role="status">
                    {localeText(locale, "Preview mode · publication uses the same renderer contract", "Voorbeeldmodus · publicatie gebruikt hetzelfde renderercontract", "وضع المعاينة · يستخدم النشر عقد العرض نفسه")}
                </div>
            ) : null}
            {blocks.map((block, index) => (
                <RenderBlock block={block} locale={locale} mode={mode} templateId={templateId} dataSnapshots={dataSnapshots} key={block.props.id ?? `${block.type}-${index}`} />
            ))}
        </div>
    );
}
