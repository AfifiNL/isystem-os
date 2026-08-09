"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, CheckCircle2, ChevronDown, Mail, MapPin, Phone, Clock, Building2, Loader2 } from "lucide-react";
import type { Json } from "@/shared/lib/supabase/database.types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { RichTextRenderer } from "@/features/content-engine/ui/rich-text-renderer";
import { useTemplate } from "@/features/templates/template-provider";
import {
    buildContactDetailItems,
    extractContactRendererData,
    translateFacilityServicesField,
    translateFacilityServicesRichText,
    translateFacilityServicesListItem,
} from "@/features/builder/facility-services-renderer-data";
import { buildFacilityServicesContactPayload } from "./facility-services-contact-payload";
import { prefersReducedMotion, scrubCards } from "./gsap-utils";

gsap.registerPlugin(ScrollTrigger);

interface ThemeContactProps {
    locale: string;
    dictionary: Record<string, unknown>;
    visualLayout?: Json | null;
}

export default function FacilityServicesContact({ locale, visualLayout }: ThemeContactProps) {
    const { config } = useTemplate();
    const resolvedLocale = locale === "nl" ? "nl" : "en";
    const builderData = extractContactRendererData(visualLayout);

    const faqRef = useRef<HTMLElement>(null);
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    // Form state handling
    const [formData, setFormData] = useState({
        name: "",
        company: "",
        email: "",
        phone: "",
        facilitySize: "",
        needs: "",
        website: "",
        formStartedAt: new Date().toISOString(),
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus("idle");
        setErrorMessage("");

        try {
            const response = await fetch("/api/contact/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildFacilityServicesContactPayload(formData, config.id, resolvedLocale)),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Something went wrong.");
            }

            setSubmitStatus("success");
            setFormData({
                name: "",
                company: "",
                email: "",
                phone: "",
                facilitySize: "",
                needs: "",
                website: "",
                formStartedAt: new Date().toISOString(),
            });
        } catch (err: unknown) {
            setSubmitStatus("error");
            if (err instanceof Error) {
                setErrorMessage(err.message);
            } else {
                setErrorMessage("An unexpected error occurred.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    useGSAP(() => {
        if (!faqRef.current) return;
        if (prefersReducedMotion()) {
            gsap.set("[data-faq-item]", { opacity: 1, y: 0 });
            return;
        }

        scrubCards(faqRef.current, "[data-faq-item]", { y: 18, startOffset: "top 86%", endOffset: "top 36%", stagger: 0.06 });
    }, { scope: faqRef });

    const contactData = builderData.main;
    const detailItems = buildContactDetailItems(resolvedLocale, contactData);
    const details = [
        { icon: Mail, ...detailItems[0] },
        { icon: Phone, ...detailItems[1] },
        { icon: MapPin, ...detailItems[2] },
        { icon: Building2, ...detailItems[3] },
        { icon: Clock, ...detailItems[4] },
    ];

    return (
        <div className="min-h-screen bg-white [font-family:var(--font-inter)] text-slate-900">
            <section className="bg-[#002f58] py-24">
                <div className="container mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 lg:grid-cols-2">
                    <div className="text-white">
                        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/65">{translateFacilityServicesField(resolvedLocale, contactData.eyebrow)}</p>
                        <h1 className="mb-4 text-4xl font-extrabold lg:text-5xl">{translateFacilityServicesField(resolvedLocale, contactData.title)}</h1>
                        <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, contactData.description)} className="text-lg leading-relaxed text-white/80 [&_a]:text-white [&_a]:underline" />
                    </div>
                    <div className="relative h-[330px] overflow-hidden border border-white/20 lg:h-[430px]">
                        <Image
                            src={contactData.heroImage}
                            alt={translateFacilityServicesField(resolvedLocale, contactData.heroImageAlt)}
                            fill
                            sizes="(max-width: 1024px) 100vw, 45vw"
                            className="object-cover"
                        />
                    </div>
                </div>
            </section>

            <section className="bg-slate-50 py-20">
                <div className="container mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-1">
                        {details.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-3 border border-slate-200 bg-white p-4">
                                <item.icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0d4f8c]" />
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
                                    <p className="text-sm font-medium text-slate-700">{item.value}</p>
                                </div>
                            </div>
                        ))}
                        <div className="border border-slate-200 bg-white p-5">
                            <h3 className="mb-3 text-lg font-bold text-slate-900">{translateFacilityServicesField(resolvedLocale, contactData.trustTitle)}</h3>
                            <ul className="space-y-2">
                                {contactData.trustItems.map((entry) => (
                                    <li key={entry.id} className="flex items-start gap-2 text-sm text-slate-600">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0d4f8c]" />
                                        <span>{translateFacilityServicesListItem(resolvedLocale, entry)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="border border-slate-200 bg-white p-8 lg:col-span-2">
                        <h2 className="mb-2 text-2xl font-bold text-slate-900">{translateFacilityServicesField(resolvedLocale, contactData.formTitle)}</h2>
                        <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, contactData.formSubtitle)} className="mb-8 text-sm text-slate-600" />

                        {submitStatus === "success" && (
                            <div className="mb-8 border-s-4 border-green-500 bg-green-50 p-4">
                                <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, contactData.successMessage)} className="text-sm font-medium text-green-800" />
                            </div>
                        )}

                        {submitStatus === "error" && (
                            <div className="mb-8 border-s-4 border-red-500 bg-red-50 p-4">
                                <p className="text-sm font-medium text-red-800">{errorMessage}</p>
                            </div>
                        )}

                        <form onSubmit={handleFormSubmit} className="space-y-5">
                            <div className="hidden" aria-hidden="true">
                                <label>
                                    Website
                                    <input
                                        tabIndex={-1}
                                        autoComplete="off"
                                        value={formData.website}
                                        onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                                    />
                                </label>
                            </div>
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">{translateFacilityServicesField(resolvedLocale, contactData.fieldName)}</label>
                                    <Input
                                        required
                                        placeholder="John Doe"
                                        className="h-11 rounded-none"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">{translateFacilityServicesField(resolvedLocale, contactData.fieldCompany)}</label>
                                    <Input
                                        placeholder="Acme Corp"
                                        className="h-11 rounded-none"
                                        value={formData.company}
                                        onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">{translateFacilityServicesField(resolvedLocale, contactData.fieldEmail)}</label>
                                    <Input
                                        required
                                        type="email"
                                        placeholder="team@company.com"
                                        className="h-11 rounded-none"
                                        value={formData.email}
                                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">{translateFacilityServicesField(resolvedLocale, contactData.fieldPhone)}</label>
                                    <Input
                                        type="tel"
                                        placeholder="+31 6 12345678"
                                        className="h-11 rounded-none"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">{translateFacilityServicesField(resolvedLocale, contactData.fieldFacilitySize)}</label>
                                <select
                                    className="h-11 w-full rounded-none border border-slate-300 px-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
                                    value={formData.facilitySize}
                                    onChange={(e) => setFormData(prev => ({ ...prev, facilitySize: e.target.value }))}
                                    disabled={isSubmitting}
                                >
                                    <option value="">{translateFacilityServicesField(resolvedLocale, contactData.facilitySizePlaceholder)}</option>
                                    {contactData.fieldFacilitySizeOptions.map((opt) => (
                                        <option key={opt.id} value={translateFacilityServicesListItem(resolvedLocale, opt)}>{translateFacilityServicesListItem(resolvedLocale, opt)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">{translateFacilityServicesField(resolvedLocale, contactData.fieldNeeds)}</label>
                                <Textarea
                                    placeholder={translateFacilityServicesField(resolvedLocale, contactData.formNeedsPlaceholder)}
                                    className="min-h-[130px] rounded-none focus-visible:ring-slate-400"
                                    value={formData.needs}
                                    onChange={(e) => setFormData(prev => ({ ...prev, needs: e.target.value }))}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="h-12 rounded-none bg-[#0d4f8c] px-7 text-white hover:bg-[#0a3f70]"
                            >
                                {isSubmitting ? (
                                    <>
                                        {translateFacilityServicesField(resolvedLocale, contactData.submitPendingLabel)}
                                        <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                                    </>
                                ) : (
                                    <>
                                        {translateFacilityServicesField(resolvedLocale, contactData.submitLabel)}
                                        <ArrowRight className="ms-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </div>
                </div>
            </section>

            <section ref={faqRef} className="border-t border-slate-200 bg-white py-20">
                <div className="container mx-auto max-w-4xl px-4">
                    <h2 className="mb-10 text-center text-3xl font-bold text-slate-900">{translateFacilityServicesField(resolvedLocale, contactData.faqTitle)}</h2>
                    <div className="space-y-3">
                        {contactData.faqItems.map((faq, idx) => {
                            const isOpen = openFaq === idx;
                            return (
                                <article key={faq.id} data-faq-item className="border border-slate-200 bg-slate-50">
                                    <button type="button" onClick={() => setOpenFaq(isOpen ? null : idx)} className="flex w-full items-center justify-between gap-4 p-5 text-start">
                                        <span className="text-sm font-semibold text-slate-900">{translateFacilityServicesField(resolvedLocale, faq.question)}</span>
                                        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                    </button>
                                    <div className={`overflow-hidden px-5 transition-all duration-300 ${isOpen ? "max-h-40 pb-5" : "max-h-0"}`}>
                                        <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, faq.answer)} className="text-sm leading-relaxed text-slate-600" />
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>
        </div>
    );
}
