"use client";

import { useState } from "react";
import { useLocale } from "@/features/templates/template-provider";
import { ScrollReveal } from "@/shared/ui/animations/scroll-reveal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Building, Mail, User, Phone, CheckCircle2 } from "lucide-react";
import { Locale } from "@/features/templates/types";

export function QuoteRequestForm() {
    const locale = useLocale() as Locale;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Simulate API call
        setTimeout(() => {
            setIsSubmitting(false);
            setIsSuccess(true);
            setTimeout(() => setIsSuccess(false), 5000);
        }, 1500);
    };

    return (
        <section className="py-24 bg-background relative" id="quote">
            <div className="container mx-auto px-4 md:px-6 max-w-5xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                    {/* Left content */}
                    <div>
                        <ScrollReveal>
                            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--template-primary)] mb-4">
                                {locale === "en" ? "Free Consultation" : "Gratis Consultatie"}
                            </h2>
                            <p className="text-3xl md:text-5xl font-extrabold text-foreground mb-6 leading-tight">
                                {locale === "en"
                                    ? "Ready to streamline your facility?"
                                    : "Klaar om uw faciliteit te stroomlijnen?"}
                            </p>
                            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                                {locale === "en"
                                    ? "Take the operational hassle out of your workday. Request a free consultation and discover how one dedicated partner can simplify your facility management."
                                    : "Haal het operationele gedoe uit uw werkdag. Vraag een gratis consultatie aan en ontdek hoe één toegewijd partner uw facilitair beheer kan vereenvoudigen."}
                            </p>

                            <ul className="space-y-4">
                                {[
                                    locale === "en" ? "Customized facility services plan" : "Op maat gemaakt facilitair plan",
                                    locale === "en" ? "Transparent, optimized pricing models" : "Transparante, geoptimaliseerde prijsmodellen",
                                    locale === "en" ? "Dedicated account management" : "Toegewijd accountmanagement"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-foreground font-medium">
                                        <CheckCircle2 className="h-5 w-5 text-[var(--template-primary)]" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </ScrollReveal>
                    </div>

                    {/* Right Form */}
                    <div>
                        <ScrollReveal delay={0.2}>
                            <div className="bg-card border border-border/50 p-8 shadow-2xl relative overflow-hidden">
                                {/* Success State */}
                                {isSuccess ? (
                                    <div className="absolute inset-0 bg-card z-20 flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in duration-500">
                                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
                                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                                        </div>
                                        <h3 className="text-2xl font-bold mb-2">
                                            {locale === "en" ? "Request Received" : "Aanvraag Ontvangen"}
                                        </h3>
                                        <p className="text-muted-foreground">
                                            {locale === "en"
                                                ? "Our team will contact you within 24 hours to discuss your needs."
                                                : "Ons team neemt binnen 24 uur contact met u op om uw behoeften te bespreken."}
                                        </p>
                                    </div>
                                ) : null}

                                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase text-muted-foreground ms-1">
                                                {locale === "en" ? "Full Name" : "Volledige Naam"}
                                            </label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input required className="ps-10 h-12 bg-background" placeholder="John Doe" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase text-muted-foreground ms-1">
                                                {locale === "en" ? "Company" : "Bedrijf"}
                                            </label>
                                            <div className="relative">
                                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input required className="ps-10 h-12 bg-background" placeholder="Acme Corp" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase text-muted-foreground ms-1">
                                                {locale === "en" ? "Email Address" : "E-mailadres"}
                                            </label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input type="email" required className="ps-10 h-12 bg-background" placeholder="john@example.com" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase text-muted-foreground ms-1">
                                                {locale === "en" ? "Phone Number" : "Telefoonnummer"}
                                            </label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input type="tel" className="ps-10 h-12 bg-background" placeholder="+31 6 12345678" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground ms-1">
                                            {locale === "en" ? "Facility Needs (Optional)" : "Facilitaire Behoeften (Optioneel)"}
                                        </label>
                                        <Textarea
                                            className="min-h-[120px] bg-background resize-none"
                                            placeholder={locale === "en" ? "Tell us about your spaces..." : "Vertel ons over uw ruimtes..."}
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full h-14 text-lg font-bold bg-[var(--template-primary)] hover:bg-[var(--template-primary)]/90 text-white"
                                    >
                                        {isSubmitting
                                            ? (locale === "en" ? "Sending..." : "Verzenden...")
                                            : (locale === "en" ? "Request Consultation" : "Consultatie Aanvragen")}
                                    </Button>
                                </form>
                            </div>
                        </ScrollReveal>
                    </div>
                </div>
            </div>
        </section>
    );
}
