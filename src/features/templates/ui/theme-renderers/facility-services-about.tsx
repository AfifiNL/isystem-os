"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, CheckCircle2, Target, Eye } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { RichTextRenderer } from "@/features/content-engine/ui/rich-text-renderer";
import { useTemplate } from "@/features/templates/template-provider";
import { facilityServicesTheme as enTheme } from "@/shared/lib/i18n/dictionaries/en";
import { facilityServicesTheme as nlTheme } from "@/shared/lib/i18n/dictionaries/nl";
import { prefersReducedMotion, scrubCards } from "./gsap-utils";
import type { Json } from "@/shared/lib/supabase/database.types";
import {
    extractAboutRendererData,
    translateFacilityServicesField,
    translateFacilityServicesRichText,
    translateFacilityServicesListItem,
} from "@/features/builder/facility-services-renderer-data";

gsap.registerPlugin(ScrollTrigger);

interface ThemeAboutProps {
    locale: string;
    dictionary: Record<string, unknown>;
    visualLayout?: Json | null;
}

function getPath(obj: unknown, path: string) {
    return path.split(".").reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], obj);
}

export default function FacilityServicesAbout({ locale, visualLayout }: ThemeAboutProps) {
    useTemplate();
    const theme = locale === "nl" ? nlTheme : enTheme;
    const scoped = { facility_services: theme };
    const t = <T,>(path: string, fallback: T): T => (getPath(scoped, path) as T) ?? fallback;
    const resolvedLocale = locale === "nl" ? "nl" : "en";
    const builderData = extractAboutRendererData(visualLayout);

    const valuesRef = useRef<HTMLElement>(null);

    useGSAP(() => {
        if (!valuesRef.current) return;
        if (prefersReducedMotion()) {
            gsap.set("[data-about-item]", { opacity: 1, y: 0 });
            return;
        }
        scrubCards(valuesRef.current, "[data-about-item]", { y: 22, startOffset: "top 84%", endOffset: "top 35%", stagger: 0.08 });
    }, { scope: valuesRef });

    return (
        <div className="min-h-screen bg-white [font-family:var(--font-inter)] text-slate-900">
            <section className="bg-[#002f58] py-24 lg:py-32">
                <div className="container mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 lg:grid-cols-2">
                    <div className="text-white">
                        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/65">{translateFacilityServicesField(resolvedLocale, builderData.about.eyebrow)}</p>
                        <RichTextRenderer
                            content={translateFacilityServicesRichText(resolvedLocale, builderData.about.headline)}
                            className="mb-5 text-4xl font-extrabold text-white lg:text-5xl [&_p]:m-0 [&_p]:text-inherit [&_strong]:text-inherit [&_a]:text-white [&_a]:underline"
                        />
                        <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, builderData.about.description)} className="mb-8 text-lg leading-relaxed text-white/80 [&_a]:text-white [&_a]:underline" />
                        <Button asChild size="lg" className="rounded-none bg-white px-8 py-6 text-[#002f58] hover:bg-slate-100">
                            <Link href="/contact" className="inline-flex items-center gap-2">
                                {t("facility_services.cta.button_text", "Request Consultation")}
                                <ArrowRight className="h-5 w-5" />
                            </Link>
                        </Button>
                    </div>
                    <div className="relative h-[360px] overflow-hidden border border-white/20 lg:h-[460px]">
                        <Image
                            src={builderData.about.image}
                            alt={translateFacilityServicesField(resolvedLocale, builderData.about.imageAlt)}
                            fill
                            sizes="(max-width: 1024px) 100vw, 45vw"
                            className="object-cover"
                        />
                    </div>
                </div>
            </section>

            <section className="border-b border-slate-200 bg-white py-20">
                <div className="container mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 md:grid-cols-2">
                    <article className="border border-slate-200 bg-slate-50 p-8">
                        <Target className="mb-4 h-8 w-8 text-[#0d4f8c]" />
                        <h2 className="mb-3 text-2xl font-bold">{translateFacilityServicesField(resolvedLocale, builderData.about.missionTitle)}</h2>
                        <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, builderData.about.missionText)} className="leading-relaxed text-slate-600" />
                    </article>
                    <article className="border border-slate-200 bg-slate-50 p-8">
                        <Eye className="mb-4 h-8 w-8 text-[#0d4f8c]" />
                        <h2 className="mb-3 text-2xl font-bold">{translateFacilityServicesField(resolvedLocale, builderData.about.visionTitle)}</h2>
                        <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, builderData.about.visionText)} className="leading-relaxed text-slate-600" />
                    </article>
                </div>
            </section>

            <section ref={valuesRef} className="bg-slate-50 py-20">
                <div className="container mx-auto max-w-5xl px-4">
                    <h2 className="mb-4 text-3xl font-bold text-slate-900">{translateFacilityServicesField(resolvedLocale, builderData.about.whyTitle)}</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {builderData.about.whyPoints.map((point) => (
                            <div key={point.id} data-about-item className="border border-slate-200 bg-white p-5">
                                <p className="flex items-start gap-2 text-sm font-medium text-slate-700">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0d4f8c]" />
                                    <span>{translateFacilityServicesListItem(resolvedLocale, point)}</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-white py-20">
                <div className="container mx-auto max-w-4xl px-4 text-center">
                    <h2 className="mb-4 text-3xl font-bold text-slate-900">{translateFacilityServicesField(resolvedLocale, builderData.commitment.title)}</h2>
                    <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, builderData.commitment.description)} className="text-lg leading-relaxed text-slate-600" />
                </div>
            </section>
        </div>
    );
}
