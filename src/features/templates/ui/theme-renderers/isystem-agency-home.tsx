"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Building2, CheckCircle2, DatabaseZap, Globe2, GraduationCap, Scale, ShieldCheck, Sparkles, TimerReset, UtensilsCrossed, XCircle } from "lucide-react";
import { useTemplate } from "@/features/templates/template-provider";
import { Button } from "@/shared/ui/button";
import { SafeRichText } from "@/shared/ui/safe-rich-text";
import type { Json } from "@/shared/lib/supabase/database.types";
import { buildIsystemHomePageData } from "./isystem-agency-renderer-data";
import { ParticleFieldScene } from "@/features/templates/ui/three";
import { HorizonHeroSection } from "@/components/ui/horizon-hero-section";
import { TechStackOrbit } from "@/components/ui/tech-stack-orbit";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { ExtraBlocksTail } from "@/features/templates/ui/extra-blocks-tail";

gsap.registerPlugin(ScrollTrigger);

interface ThemeHomeProps {
    workspace: {
        id: string;
        name: string;
        slug: string;
        theme_id: string | null;
    };
    dictionary: Record<string, unknown>;
    locale: string;
    visualLayout?: Json | null;
}

export function IsystemAgencyHome({ locale, visualLayout }: ThemeHomeProps) {
    const { config } = useTemplate();
    const resolvedLocale = (locale === "nl" || locale === "ar" || locale === "en")
        ? (locale as "en" | "nl" | "ar")
        : "en";
    const isNl = resolvedLocale === "nl";
    const isAr = resolvedLocale === "ar";
    const splineSectionRef = useRef<HTMLElement | null>(null);

    const data = buildIsystemHomePageData(config, resolvedLocale, visualLayout);
    const operatingModelCards = [
        {
            title: data.operatingModelTitle,
            body: data.operatingModelDescription,
        },
        {
            title: isAr ? "إشارة الثقة" : isNl ? "Vertrouwenssignaal" : "Trust signal",
            body: data.operatingModelSupportLine,
        },
    ];
    const rejectionList = isAr
        ? [
            "شركات ناشئة ممولة ولديها فريق نمو من 30 شخصًا.",
            "شركات معاملات عالية تناسب Shopify أو أدوات التجارة الجاهزة.",
            "من يريد ذكاءً اصطناعيًا غير محدود وغير محكوم بلا مراجعة.",
            "من يريد علاقة وكالة متعددة الفرق بدل شراكة مباشرة مع المؤسس.",
        ]
        : isNl
            ? [
                "VC-gedreven startups met een growth team van 30 mensen.",
                "High-transaction marketplaces die beter in Shopify passen.",
                "Kopers die onbeperkte, ongereguleerde AI zonder review willen.",
                "Organisaties die een meerlaags agencyteam zoeken in plaats van direct founder-contact.",
            ]
            : [
                "VC-funded startups with a 30-person growth team.",
                "High-transaction marketplaces better served by Shopify-style tooling.",
                "Buyers who want unmetered, ungoverned AI without review.",
                "Teams looking for a multi-layer agency relationship instead of direct founder contact.",
            ];
    const fitList = isAr
        ? ["شركات خدمات من 5–50 شخصًا متعبة من كثرة الأدوات.", "فرق تشغيل تحتاج سجل تدقيق وGDPR وقرارات قابلة للمراجعة.", "مشغّلون متعددو اللغات يحتاجون EN/NL/AR وRTL في نفس المساحة."]
        : isNl
            ? ["Servicebedrijven van 5–50 mensen die genoeg hebben van zes losse tools.", "Operations teams die audit trails, GDPR en reviewbare AI nodig hebben.", "Meertalige operators die EN/NL/AR en RTL in dezelfde workspace nodig hebben."]
            : ["5–50-person service businesses tired of running across six separate tools.", "Operations teams that need audit trails, GDPR posture, and reviewable AI.", "Multilingual operators who need EN/NL/AR and RTL in the same workspace."];

    const sectorLabels = isAr
        ? { horeca: "الضيافة", education: "التعليم", legal: "القطاع القانوني", media: "الإعلام", realEstate: "العقارات" }
        : isNl
            ? { horeca: "Horeca", education: "Onderwijs", legal: "Legal", media: "Media", realEstate: "Vastgoed" }
            : { horeca: "Horeca", education: "Education", legal: "Legal", media: "Media", realEstate: "Real Estate" };
    const sectors: Array<{ icon: LucideIcon; label: string; href: string }> = [
        { icon: UtensilsCrossed, label: sectorLabels.horeca, href: "/horeca-digital-systems" },
        { icon: GraduationCap, label: sectorLabels.education, href: "/education-digital-systems" },
        { icon: Scale, label: sectorLabels.legal, href: "/legal-digital-systems" },
        { icon: Sparkles, label: sectorLabels.media, href: "/media-agency-digital-systems" },
        { icon: Building2, label: sectorLabels.realEstate, href: "/real-estate-digital-systems" },
    ];
    const sectorsHeading = isAr ? "القطاعات التي ندعمها" : isNl ? "Sectoren die wij bedienen" : "Industries we support";
    const nextStepEyebrow = isAr ? "الخطوة التالية" : isNl ? "Volgende stap" : "Next step";
    const ctaHeadline = isAr
        ? "حوّل عملياتك إلى نظام رقمي قابل للتوسّع."
        : isNl
            ? "Vertaal uw operatie naar een schaalbaar digitaal systeem."
            : "Translate your operations into a scalable digital system.";
    const ctaSubtitle = isAr
        ? "سواء كنت شركة نامية تبحث عن وضوح تشغيلي أو فريقًا مؤسسيًا يطلب دعمًا متخصّصًا، نساعدك على هيكلة الخطوة التالية."
        : isNl
            ? "Of u nu een groeiend bedrijf bent dat grip wil op de operatie of een enterprise team dat specialistische ondersteuning zoekt, wij helpen u de volgende stap te structureren."
            : "Whether you are a growing business seeking operational clarity or an enterprise team looking for specialist support, we help you structure the next step.";
    const ctaButtonLabel = isAr ? "ناقش نظامك" : isNl ? "Bespreek uw systeem" : "Discuss your system";
    const toLocalizedHref = (href: string) => localizeHref(resolvedLocale, href);

    useGSAP(
        () => {
            if (!splineSectionRef.current) return;

            gsap.set("[data-spline-eyebrow]", { y: 18, opacity: 0 });
            gsap.set("[data-spline-title]", { y: 42, opacity: 0 });
            gsap.set("[data-spline-copy]", { y: 24, opacity: 0 });
            gsap.set("[data-spline-card]", { y: 48, opacity: 0, scale: 0.96 });

            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: splineSectionRef.current,
                    start: "top 78%",
                    end: "top 30%",
                    scrub: 1.2,
                },
            });

            tl.to("[data-spline-eyebrow]", { y: 0, opacity: 1, duration: 0.18 })
                .to("[data-spline-title]", { y: 0, opacity: 1, duration: 0.26 }, 0.05)
                .to("[data-spline-copy]", { y: 0, opacity: 1, duration: 0.22 }, 0.12)
                .to("[data-spline-card]", { y: 0, opacity: 1, scale: 1, duration: 0.32 }, 0.1);

            return () => {
                tl.scrollTrigger?.kill();
                tl.kill();
            };
        },
        { scope: splineSectionRef }
    );

    return (
        <div className="bg-[oklch(0.955_0.026_248)] text-[var(--template-text-primary)] selection:bg-cyan-500/20">
            {/* Hero Section */}
            <section className="relative overflow-hidden border-b border-[var(--template-border-soft)] bg-[linear-gradient(180deg,oklch(0.982_0.018_248)_0%,oklch(0.948_0.032_246)_100%)]">
                <div className="absolute inset-0 pointer-events-none opacity-20 mix-blend-multiply">
                    <ParticleFieldScene className="absolute inset-0" />
                </div>
                <HorizonHeroSection
                    tone="light"
                    locale={resolvedLocale}
                    eyebrow={[data.badge]}
                    titleLines={[data.titleLineOne, data.titleLineTwo]}
                    subtitle={data.subtitle}
                    primaryCta={data.primaryCta}
                    secondaryCta={data.secondaryCta}
                    trustBadges={data.trustBadges}
                />
            </section>

            <section ref={splineSectionRef} className="relative overflow-hidden border-b border-[var(--template-border-inverse)] [background:var(--template-surface-dark)] px-4 py-24 text-[var(--template-text-inverse)] md:px-6 md:py-28">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20 [mask-image:radial-gradient(circle_at_center,#000_30%,transparent_85%)]" />
                <div className="container relative z-10 mx-auto max-w-7xl">
                    <div className="mb-12 max-w-3xl">
                        <p data-spline-eyebrow className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-300">
                            {data.servicesEyebrow}
                        </p>
                        <h2 data-spline-title className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl">
                            {data.servicesTitle}
                        </h2>
                        {data.servicesDescription ? (
                            <SafeRichText
                                as="p"
                                value={data.servicesDescription}
                                data-spline-copy
                                className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300"
                            />
                        ) : null}
                    </div>

                    <div data-spline-card className="grid gap-6 lg:grid-cols-[3fr_2fr] items-stretch min-h-[540px]">
                        <TechStackOrbit />
                        <div className="flex flex-col gap-4">
                            {data.servicesList.map((service, idx) => (
                                <motion.article
                                    key={idx}
                                    initial={{ opacity: 0, x: 20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.12 }}
                                    className="group relative flex flex-1 flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 transition-colors hover:bg-white/[0.07]"
                                >
                                    <div className="absolute right-0 top-0 p-5 opacity-10 transition-opacity group-hover:opacity-20">
                                        <span className="text-5xl font-bold text-white">{String(idx + 1).padStart(2, '0')}</span>
                                    </div>
                                    <div className="relative z-10">
                                        <h3 className="mb-2 text-lg font-semibold text-white">{service.title}</h3>
                                        <SafeRichText as="p" value={service.description} className="text-sm leading-relaxed text-slate-400" />
                                    </div>
                                </motion.article>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Operating model — the two cards are sourced from FoundationBlock
                (title / description / supportLine), so the page-builder
                remains the management surface for the editable copy here. */}
            <section className="relative overflow-hidden border-b border-[var(--template-border-soft)] bg-[linear-gradient(180deg,oklch(0.974_0.018_248)_0%,oklch(0.948_0.025_246)_100%)] px-4 py-20 md:px-6 md:py-24">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,color-mix(in_oklch,var(--template-primary)_12%,transparent),transparent_34%),radial-gradient(circle_at_82%_10%,color-mix(in_oklch,var(--template-accent)_16%,transparent),transparent_30%),linear-gradient(120deg,rgba(15,30,54,0.035),transparent_45%)]" />
                <div className="container relative z-10 mx-auto max-w-7xl">
                    <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--template-text-accent-strong)]">
                                {isAr ? "النموذج التشغيلي" : isNl ? "Werkmodel" : "Operating model"}
                            </p>
                            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--template-text-primary)] md:text-5xl">
                                {isAr ? "شيء ثالث: لا وكالة، لا SaaS، بل مساحة عمل." : isNl ? "Een derde ding: geen agency, geen SaaS, maar een workspace." : "A third thing: not an agency, not SaaS — a workspace."}
                            </h2>
                        </div>
                        <p className="text-lg leading-8 text-[var(--template-text-secondary)]">
                            {isAr
                                ? "من أطروحة روتردام إلى منصة عاملة: اجمع الموقع والمحتوى والسيو والنشرة والبودكاست والحجوزات والحوكمة في بيئة واحدة، مع سجل ذكاء اصطناعي واضح وشخص مسؤول تعرفه بالاسم."
                                : isNl
                                    ? "Van Rotterdamse scriptie naar werkend platform: breng website, content, SEO, nieuwsbrief, podcast, boekingen en governance samen in één werkomgeving, met een helder AI-grootboek en één aanspreekbare operator."
                                    : "From Rotterdam thesis to working platform: bring your website, content, SEO, newsletter, podcast, bookings, and governance into one environment, with a clear AI ledger and one accountable operator."}
                        </p>
                    </div>

                    <div className="mt-10 grid gap-4 md:grid-cols-2">
                        {operatingModelCards.map((card, idx) => (
                            <motion.article
                                key={idx}
                                initial={{ opacity: 0, y: 18 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.08 }}
                                className="rounded-3xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-6 shadow-[var(--template-depth-sm)] backdrop-blur-md"
                            >
                                <h3 className="text-xl font-semibold text-[var(--template-text-primary)]">{card.title}</h3>
                                <SafeRichText as="p" value={card.body} className="mt-3 text-sm leading-7 text-[var(--template-text-secondary)]" />
                            </motion.article>
                        ))}
                    </div>
                </div>
            </section>

            {/* Sectors Section */}
            <section className="border-y border-[var(--template-border-soft)] bg-[linear-gradient(180deg,oklch(0.935_0.033_246),oklch(0.905_0.043_244))] px-4 py-20 md:px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--template-primary)_13%,transparent)_0%,transparent_72%),linear-gradient(90deg,rgba(12,24,42,0.055),transparent_38%,rgba(191,141,33,0.055))]" />
                <div className="container relative z-10 mx-auto max-w-7xl">
                    <div className="flex items-center gap-3 text-[var(--template-text-accent-strong)] justify-center mb-12">
                        <Globe2 className="h-5 w-5" />
                        <span className="text-sm font-bold uppercase tracking-[0.2em]">{sectorsHeading}</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        {sectors.map(({ icon: Icon, label, href }, idx) => (
                            <motion.div 
                                key={label} 
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.1 }}
                                className="rounded-2xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] shadow-[var(--template-depth-sm)] backdrop-blur-md transition-colors hover:[background:var(--template-surface-light)]"
                            >
                                <Link href={toLocalizedHref(href)} className="block p-6 text-center">
                                    <Icon className="mx-auto mb-4 h-8 w-8 text-[var(--template-primary)]" />
                                    <p className="font-medium text-[var(--template-text-primary)]">{label}</p>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="border-y border-[var(--template-border-soft)] bg-[linear-gradient(180deg,oklch(0.935_0.033_246),oklch(0.905_0.043_244))] px-4 py-14 md:px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="grid gap-4 rounded-[2rem] border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-5 shadow-[var(--template-depth-md)] backdrop-blur-md md:grid-cols-[1.1fr_repeat(3,0.8fr)] md:p-6">
                        <div>
                            <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-[var(--template-text-accent-strong)]">
                                <DatabaseZap className="h-4 w-4" /> {isAr ? "منهجية المصادر" : isNl ? "Bronmethodiek" : "Source methodology"}
                            </p>
                            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--template-text-primary)] md:text-3xl">
                                {isAr ? "الأدلة قبل الادعاءات." : isNl ? "Bewijs vóór claims." : "Evidence before claims."}
                            </h2>
                            <p className="mt-3 text-sm leading-7 text-[var(--template-text-secondary)]">
                                {isAr ? "نربط المحتوى بمصادر عامة آمنة ومراجَعة، دون عرض بيانات داخلية أو نصوص استخراج خام." : isNl ? "We koppelen content aan publiek veilige, beoordeelde bronnen zonder interne jobdata of ruwe extracties te tonen." : "Content is linked to public-safe reviewed sources without exposing internal jobs or raw extraction payloads."}
                            </p>
                        </div>
                        {[
                            { icon: ShieldCheck, label: isAr ? "مصادر سلطة" : isNl ? "Autoriteitsbronnen" : "Authority sources", value: "EU / NL" },
                            { icon: TimerReset, label: isAr ? "تحديثات دورية" : isNl ? "Periodieke refresh" : "Periodic refresh", value: "7–30d" },
                            { icon: Sparkles, label: isAr ? "موضوعات مراقبة" : isNl ? "Bewaakte thema's" : "Watched themes", value: "SME · GDPR · AI" },
                        ].map(({ icon: Icon, label, value }) => (
                            <div key={label} className="rounded-2xl border border-[var(--template-border-soft)] bg-background/45 p-4">
                                <Icon className="h-5 w-5 text-[var(--template-primary)]" />
                                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--template-text-subtle)]">{label}</p>
                                <p className="mt-1 text-lg font-bold text-[var(--template-text-primary)]">{value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Difference Section */}
            <section className="relative overflow-hidden bg-[linear-gradient(180deg,oklch(0.955_0.026_248),oklch(0.972_0.016_248))] px-4 py-24 md:px-6">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,color-mix(in_oklch,var(--template-primary)_9%,transparent),transparent_32%),radial-gradient(circle_at_90%_70%,color-mix(in_oklch,var(--template-accent)_11%,transparent),transparent_30%)]" />
                <div className="container relative z-10 mx-auto max-w-7xl">
                    <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                        >
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--template-text-accent-strong)] mb-4">{data.whyEyebrow}</p>
                            <h2 className="text-3xl font-bold md:text-5xl leading-tight">
                                {data.whyTitle}
                            </h2>
                            {data.whyDescription && (
                                <SafeRichText as="p" value={data.whyDescription} className="mt-4 text-lg text-[var(--template-text-secondary)]" />
                            )}
                        </motion.div>
                        <div className="grid gap-6 sm:grid-cols-2">
                            {data.whyPoints.map((point, idx) => {
                                const [title, ...descParts] = point.split(":");
                                const description = descParts.join(":").trim();
                                const safeTitle = description ? title.trim() : point;
                                
                                return (
                                    <motion.div 
                                        key={idx} 
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: idx * 0.1 }}
                                        className={`rounded-3xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-6 shadow-[var(--template-depth-sm)] backdrop-blur-md ${idx === 2 ? 'sm:col-span-2' : ''}`}
                                    >
                                        <h3 className="font-semibold text-[var(--template-text-primary)] text-lg mb-2">{safeTitle}</h3>
                                        {description && <p className="text-[var(--template-text-secondary)] leading-relaxed">{description}</p>}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* Fit / non-fit section. The brief explicitly requires the
                rejection list on the home page because it builds trust with
                Dutch SME buyers. */}
            <section className="border-y border-[var(--template-border-soft)] bg-[linear-gradient(180deg,oklch(0.968_0.017_248),oklch(0.94_0.026_246))] px-4 py-20 md:px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="mb-10 max-w-3xl">
                        <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-700">
                            {isAr ? "لمن يناسب — ولمن لا يناسب" : isNl ? "Voor wie dit past — en voor wie niet" : "Who this is for — and who it is not for"}
                        </p>
                        <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--template-text-primary)] md:text-5xl">
                            {isAr ? "الوضوح قبل المكالمة أفضل من عرض مبالغ فيه." : isNl ? "Duidelijkheid vóór het gesprek is beter dan een opgeblazen pitch." : "Clarity before the call beats an inflated pitch."}
                        </h2>
                    </div>
                    <div className="grid gap-5 lg:grid-cols-2">
                        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-6">
                            <div className="mb-5 flex items-center gap-3 text-emerald-700">
                                <CheckCircle2 className="h-5 w-5" />
                                <h3 className="text-lg font-semibold">{isAr ? "تناسب جيد" : isNl ? "Goede fit" : "Good fit"}</h3>
                            </div>
                            <ul className="space-y-3">
                                {fitList.map((item) => (
                                    <li key={item} className="text-sm leading-7 text-[var(--template-text-secondary)]">{item}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/5 p-6">
                            <div className="mb-5 flex items-center gap-3 text-rose-700">
                                <XCircle className="h-5 w-5" />
                                <h3 className="text-lg font-semibold">{isAr ? "ليست مناسبة" : isNl ? "Niet de juiste fit" : "Not the right fit"}</h3>
                            </div>
                            <ul className="space-y-3">
                                {rejectionList.map((item) => (
                                    <li key={item} className="text-sm leading-7 text-[var(--template-text-secondary)]">{item}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="bg-[linear-gradient(180deg,oklch(0.94_0.026_246)_0%,oklch(0.91_0.04_244)_100%)] px-4 pb-24 md:px-6">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="container mx-auto max-w-5xl relative overflow-hidden rounded-[2.5rem] border border-[var(--template-border-accent-soft)] [background:var(--template-surface-premium-raised)] p-10 md:p-16 text-center shadow-[var(--template-depth-lg)]"
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.15)_0%,transparent_60%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.15)_0%,transparent_60%)]" />
                    
                    <div className="relative z-10">
                        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--template-text-accent-strong)] mb-4">{nextStepEyebrow}</p>
                        <h2 className="mx-auto max-w-3xl text-4xl font-bold text-white md:text-5xl lg:text-6xl leading-tight mb-6">
                            {ctaHeadline}
                        </h2>
                        <p className="mx-auto max-w-2xl text-lg text-[var(--template-text-inverse-muted)] mb-10">
                            {ctaSubtitle}
                        </p>
                        <Button asChild size="lg" className="h-14 px-10 bg-[var(--template-text-inverse)] text-[var(--template-accent-fg)] hover:bg-[color-mix(in_oklch,var(--template-text-inverse)_88%,var(--template-accent))] font-semibold text-base rounded-full">
                            <Link href={toLocalizedHref("/contact")}>
                                {ctaButtonLabel}
                                <ArrowRight className="ms-2 h-5 w-5 rtl-flip" />
                            </Link>
                        </Button>
                    </div>
                </motion.div>
            </section>

            {/* Author-added blocks (insights grid, FAQ, pricing, etc.) that
                aren't part of the bespoke composition above. Rendered last
                so the curated narrative stays intact and authors can
                append further sections from the page builder. */}
            <ExtraBlocksTail pageKind="home" visualLayout={visualLayout} locale={resolvedLocale} />
        </div>
    );
}
