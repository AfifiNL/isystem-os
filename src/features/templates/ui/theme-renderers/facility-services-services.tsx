"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { Json } from "@/shared/lib/supabase/database.types";
import { Button } from "@/shared/ui/button";
import { RichTextRenderer } from "@/features/content-engine/ui/rich-text-renderer";
import { useTemplate } from "@/features/templates/template-provider";
import {
    extractServicesRendererData,
    translateFacilityServicesField,
    translateFacilityServicesRichText,
    translateFacilityServicesListItem,
} from "@/features/builder/facility-services-renderer-data";
import { prefersReducedMotion, scrubCards } from "./gsap-utils";

gsap.registerPlugin(ScrollTrigger);

interface ThemeServicesProps {
    locale: string;
    dictionary: Record<string, unknown>;
    visualLayout?: Json | null;
}

export default function FacilityServicesServices({ locale, visualLayout }: ThemeServicesProps) {
    useTemplate();
    const resolvedLocale = locale === "nl" ? "nl" : "en";
    const builderData = extractServicesRendererData(visualLayout);

    const cardsRef = useRef<HTMLElement>(null);
    const processRef = useRef<HTMLElement>(null);

    useGSAP(() => {
        if (!cardsRef.current) return;
        if (prefersReducedMotion()) {
            gsap.set("[data-services-card]", { opacity: 1, y: 0 });
            return;
        }
        scrubCards(cardsRef.current, "[data-services-card]", { y: 22, startOffset: "top 86%", endOffset: "top 35%", stagger: 0.08 });
    }, { scope: cardsRef });

    useGSAP(() => {
        if (!processRef.current) return;
        if (prefersReducedMotion()) {
            gsap.set("[data-process-row]", { opacity: 1, y: 0 });
            return;
        }
        scrubCards(processRef.current, "[data-process-row]", { y: 20, startOffset: "top 86%", endOffset: "top 40%", stagger: 0.06 });
    }, { scope: processRef });

    const services = builderData.showcase.items.map((item) => ({
        id: item.id,
        title: translateFacilityServicesField(resolvedLocale, item.title),
        description: translateFacilityServicesRichText(resolvedLocale, item.description),
        image: item.image,
        alt: translateFacilityServicesField(resolvedLocale, item.alt),
        features: item.features.map((feature) => translateFacilityServicesListItem(resolvedLocale, feature)),
    }));
    const methodSteps = builderData.methodology.steps.map((step) => ({
        stepNumber: step.stepNumber,
        title: translateFacilityServicesField(resolvedLocale, step.title),
        description: translateFacilityServicesRichText(resolvedLocale, step.description),
    }));

    return (
        <div className="min-h-screen bg-white [font-family:var(--font-inter)] text-slate-900">
            <section className="border-b border-slate-200 bg-[#002f58] py-24 text-white lg:py-30">
                <div className="container mx-auto max-w-5xl px-4 text-center">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/65">{translateFacilityServicesField(resolvedLocale, builderData.showcase.title)}</p>
                    <RichTextRenderer
                        content={translateFacilityServicesRichText(resolvedLocale, builderData.showcase.subtitle)}
                        className="mb-4 text-4xl font-extrabold text-white lg:text-5xl [&_p]:m-0 [&_p]:text-inherit [&_strong]:text-inherit [&_a]:text-white [&_a]:underline"
                    />
                    <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, builderData.showcase.description)} className="mx-auto max-w-3xl text-lg leading-relaxed text-white/80 [&_a]:text-white [&_a]:underline" />
                </div>
            </section>

            <section ref={cardsRef} className="bg-slate-50 py-24">
                <div className="container mx-auto max-w-7xl space-y-8 px-4">
                    {services.map((item) => (
                        <article key={item.id} data-services-card className="grid overflow-hidden border border-slate-200 bg-white lg:grid-cols-2">
                            <div className="relative h-72 lg:h-full">
                                <Image src={item.image} alt={item.alt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                            </div>
                            <div className="p-8 lg:p-10">
                                <h2 className="mb-3 text-3xl font-bold text-slate-900">{item.title}</h2>
                                <RichTextRenderer content={item.description} className="mb-6 text-sm leading-relaxed text-slate-600" />
                                <ul className="mb-8 space-y-2">
                                    {item.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0d4f8c]" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Button asChild className="rounded-none bg-[#0d4f8c] text-white hover:bg-[#0a3f70]">
                                    <Link href={builderData.showcase.primaryHref} className="inline-flex items-center gap-2">
                                        {translateFacilityServicesField(resolvedLocale, builderData.showcase.primaryCta)}
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section ref={processRef} className="border-y border-slate-200 bg-white py-24">
                <div className="container mx-auto max-w-5xl px-4">
                    <h2 className="mb-3 text-3xl font-bold text-slate-900">{translateFacilityServicesField(resolvedLocale, builderData.methodology.title)}</h2>
                    <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, builderData.methodology.subtitle)} className="mb-10 text-slate-600" />
                    <div className="space-y-4">
                        {methodSteps.map((step) => (
                            <div key={step.stepNumber} data-process-row className="border border-slate-200 bg-slate-50 p-6">
                                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#0d4f8c]">Phase {step.stepNumber}</p>
                                <h3 className="mb-2 text-xl font-bold">{step.title}</h3>
                                <RichTextRenderer content={step.description} className="text-sm leading-relaxed text-slate-600" />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
