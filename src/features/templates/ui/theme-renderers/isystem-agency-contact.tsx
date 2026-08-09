"use client";

import { useRef, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { ExtraBlocksTail } from "@/features/templates/ui/extra-blocks-tail";
import { useScrollReveal } from "@/shared/lib/gsap/use-scroll-reveal";
import { buildIsystemContactPageData } from "./isystem-agency-renderer-data";
import type { Json } from "@/shared/lib/supabase/database.types";
import { SafeRichText } from "@/shared/ui/safe-rich-text";
import { MediaWaveScene } from "@/features/templates/ui/three";

interface ThemeSubPageProps {
  config: TemplateConfig;
  dictionary: Record<string, string>;
  locale: Locale;
  visualLayout?: Json | null;
}

export default function IsystemAgencyContact({ config, locale, visualLayout }: ThemeSubPageProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  useScrollReveal(rootRef, { y: 30, stagger: 0.1 });

  const isNl = locale === "nl";
  const isAr = locale === "ar";
  const resolvedLocale = (isNl ? "nl" : (isAr ? "ar" : "en")) as "en" | "nl" | "ar";

  const data = buildIsystemContactPageData(config, resolvedLocale, visualLayout);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    requestType: "",
    timeline: "",
    challenge: "",
    website: "", // honeypot
    formStartedAt: "",
    marketingConsent: false,
  });

  useEffect(() => {
    setFormData((prev) => ({ ...prev, formStartedAt: new Date().toISOString() }));
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitStatus("idle");
    setSubmitMessage("");

    try {
      const res = await fetch("/api/contact/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          submissionId,
          templateId: config.id,
          locale,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubmitStatus("success");
        setSubmitMessage(resData.message || "Message sent!");
        setFormData({
          name: "",
          email: "",
          company: "",
          requestType: "",
          timeline: "",
          challenge: "",
          website: "",
          formStartedAt: new Date().toISOString(),
          marketingConsent: false,
        });
        setSubmissionId(crypto.randomUUID());
      } else {
        setSubmitStatus("error");
        setSubmitMessage(resData.error || "Failed to send message.");
      }
    } catch {
      setSubmitStatus("error");
      setSubmitMessage(isNl ? "Netwerkfout. Probeer het opnieuw." : isAr ? "خطأ في الشبكة. حاول مرة أخرى." : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section ref={rootRef} className="bg-[linear-gradient(180deg,oklch(0.958_0.026_248)_0%,oklch(0.925_0.04_246)_38%,oklch(0.948_0.024_248)_100%)] py-20 text-[var(--template-text-primary)] md:py-32 relative overflow-hidden min-h-screen">
      {/* Light public theme background effects */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-6%] left-[10%] h-[520px] w-[520px] rounded-full bg-[color-mix(in_oklch,var(--template-primary)_14%,transparent)] opacity-75 blur-[130px]" />
          <div className="absolute bottom-[-10%] right-[6%] h-[650px] w-[650px] rounded-full bg-[color-mix(in_oklch,var(--template-accent)_18%,transparent)] opacity-70 blur-[165px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(27,87,143,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(27,87,143,0.04)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_78%_54%_at_50%_40%,#000_62%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(12,24,42,0.05),transparent_40%,rgba(191,141,33,0.055))]" />
      </div>

      <div className="container relative z-10 mx-auto max-w-6xl px-4 md:px-6">
        <motion.header
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--template-border-soft)] bg-[var(--template-surface-glass)] px-4 py-2 text-sm font-medium text-[var(--template-text-accent-strong)] backdrop-blur-md mb-6">
            {data.eyebrow}
          </div>
          <h1 className="text-4xl font-bold md:text-6xl lg:text-7xl leading-[1.1] tracking-tight">
            {data.headline}
          </h1>
          <SafeRichText as="p" value={data.description} className="mt-6 max-w-2xl text-lg md:text-xl text-[var(--template-text-secondary)] leading-relaxed" />
        </motion.header>

        <div className="mt-12">
          <div className="rounded-3xl border border-[var(--template-border-inverse)] [background:var(--template-surface-dark)] p-6 shadow-[var(--template-depth-lg)] backdrop-blur-xl">
            <MediaWaveScene className="h-[280px] w-full" />
          </div>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="relative rounded-3xl border border-[var(--template-border-soft)] bg-[var(--template-surface-glass)] p-8 lg:p-10 backdrop-blur-xl shadow-[var(--template-depth-md)] lg:col-span-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-amber-300/10 pointer-events-none" />
            <h2 className="text-2xl font-semibold text-[var(--template-text-primary)] mb-2 relative z-10">{data.formTitle}</h2>
            {data.formSubtitle && <SafeRichText as="p" value={data.formSubtitle} className="text-[var(--template-text-secondary)] mb-8 relative z-10" />}

            {/* Honeypot field for bot detection */}
            <div className="absolute h-px w-px overflow-hidden whitespace-nowrap" style={{ clip: "rect(0 0 0 0)", clipPath: "inset(50%)" }} aria-hidden="true">
                <label>
                    Company website
                    <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={formData.website}
                        onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    />
                </label>
            </div>

            {submitStatus === "success" && (
              <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 relative z-10 text-sm">
                {submitMessage}
              </div>
            )}

            {submitStatus === "error" && (
              <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-800 relative z-10 text-sm">
                {submitMessage}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 relative z-10 mt-6">
              <div className="space-y-2">
                  <label htmlFor="contact-name" className="text-sm font-medium text-[var(--template-text-secondary)]">{isAr ? "الاسم" : isNl ? "Naam" : "Name"}</label>
                  <input id="contact-name" type="text" required disabled={isSubmitting} value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full rounded-xl border border-[var(--template-border-soft)] bg-[color-mix(in_oklch,oklch(0.995_0.004_248)_74%,transparent)] px-4 py-3 text-[var(--template-text-primary)] placeholder:text-[var(--template-text-subtle)] focus:border-[var(--template-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--template-primary)] transition-all" placeholder={isAr ? "اسمك" : isNl ? "Uw naam" : "Your name"} />
              </div>
              <div className="space-y-2">
                  <label htmlFor="contact-email" className="text-sm font-medium text-[var(--template-text-secondary)]">{isAr ? "البريد الإلكتروني" : isNl ? "E-mailadres" : "Email"}</label>
                  <input id="contact-email" type="email" required disabled={isSubmitting} value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} className="w-full rounded-xl border border-[var(--template-border-soft)] bg-[color-mix(in_oklch,oklch(0.995_0.004_248)_74%,transparent)] px-4 py-3 text-[var(--template-text-primary)] placeholder:text-[var(--template-text-subtle)] focus:border-[var(--template-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--template-primary)] transition-all" placeholder={isAr ? "بريدك الإلكتروني" : isNl ? "Uw e-mailadres" : "Your email"} />
              </div>
              <div className="space-y-2">
                  <label htmlFor="contact-company" className="text-sm font-medium text-[var(--template-text-secondary)]">{isAr ? "الشركة" : isNl ? "Bedrijf" : "Company"}</label>
                  <input id="contact-company" type="text" disabled={isSubmitting} value={formData.company} onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))} className="w-full rounded-xl border border-[var(--template-border-soft)] bg-[color-mix(in_oklch,oklch(0.995_0.004_248)_74%,transparent)] px-4 py-3 text-[var(--template-text-primary)] placeholder:text-[var(--template-text-subtle)] focus:border-[var(--template-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--template-primary)] transition-all" placeholder={isAr ? "اسم شركتك" : isNl ? "Uw bedrijf" : "Your company"} />
              </div>
              <div className="space-y-2">
                  <label htmlFor="contact-request-type" className="text-sm font-medium text-[var(--template-text-secondary)]">{isAr ? "نوع الطلب" : isNl ? "Type aanvraag" : "Request type"}</label>
                  <select id="contact-request-type" disabled={isSubmitting} value={formData.requestType} onChange={(e) => setFormData(prev => ({ ...prev, requestType: e.target.value }))} className="w-full rounded-xl border border-[var(--template-border-soft)] bg-[color-mix(in_oklch,oklch(0.995_0.004_248)_74%,transparent)] px-4 py-3 text-[var(--template-text-primary)] focus:border-[var(--template-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--template-primary)] transition-all appearance-none">
                    <option value="" disabled>{data.requestTypePlaceholder}</option>
                    {data.requestTypeOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                  <label htmlFor="contact-timeline" className="text-sm font-medium text-[var(--template-text-secondary)]">{data.timelineLabel}</label>
                  <input id="contact-timeline" type="text" disabled={isSubmitting} value={formData.timeline} onChange={(e) => setFormData(prev => ({ ...prev, timeline: e.target.value }))} className="w-full rounded-xl border border-[var(--template-border-soft)] bg-[color-mix(in_oklch,oklch(0.995_0.004_248)_74%,transparent)] px-4 py-3 text-[var(--template-text-primary)] placeholder:text-[var(--template-text-subtle)] focus:border-[var(--template-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--template-primary)] transition-all" placeholder={data.timelinePlaceholder} />
              </div>
            </div>
            <div className="mt-6 space-y-2 relative z-10">
                <label htmlFor="contact-challenge" className="text-sm font-medium text-[var(--template-text-secondary)]">{data.challengeLabel}</label>
                <textarea id="contact-challenge" disabled={isSubmitting} value={formData.challenge} onChange={(e) => setFormData(prev => ({ ...prev, challenge: e.target.value }))} className="min-h-[160px] w-full rounded-xl border border-[var(--template-border-soft)] bg-[color-mix(in_oklch,oklch(0.995_0.004_248)_74%,transparent)] px-4 py-3 text-[var(--template-text-primary)] placeholder:text-[var(--template-text-subtle)] focus:border-[var(--template-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--template-primary)] transition-all resize-y" placeholder={data.challengePlaceholder} />
            </div>
            <label className="relative z-10 mt-6 flex items-start gap-3 text-sm leading-6 text-[var(--template-text-secondary)]">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={formData.marketingConsent}
                disabled={isSubmitting}
                onChange={(event) => setFormData((previous) => ({ ...previous, marketingConsent: event.target.checked }))}
              />
              <span>
                {isAr
                  ? "أرغب في تلقي التحديثات والموارد التسويقية من هذه المؤسسة. يمكنني إلغاء الاشتراك في أي وقت."
                  : isNl
                    ? "Ik ontvang graag marketingupdates en resources van deze organisatie. Ik kan mij altijd uitschrijven."
                    : "I would like to receive marketing updates and resources from this workspace. I can unsubscribe at any time."}
              </span>
            </label>
            <button type="submit" disabled={isSubmitting} className="mt-8 w-full sm:w-auto rounded-full px-8 py-4 text-base font-semibold text-white transition-all [background:linear-gradient(135deg,var(--template-primary),var(--template-gradient-to))] shadow-[var(--template-depth-md)] hover:opacity-95 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? (
                <span className="flex items-center gap-2 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isAr ? "جاري الإرسال..." : isNl ? "Verzenden..." : "Sending..."}
                </span>
              ) : (
                data.submitLabel
              )}
            </button>
          </motion.form>

          <div className="space-y-6">
              <motion.aside
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="rounded-3xl border border-[var(--template-border-soft)] bg-[var(--template-surface-glass)] p-8 h-fit shadow-[var(--template-depth-sm)] backdrop-blur-md"
              >
                <h3 className="text-xl font-semibold text-[var(--template-primary)] mb-6">{data.trustTitle}</h3>
                <ul className="space-y-6">
                  {data.trustItems.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--template-primary)_14%,transparent)] text-sm font-bold text-[var(--template-primary)] border border-[color-mix(in_oklch,var(--template-primary)_26%,transparent)]">
                              {idx + 1}
                          </div>
                          <p className="text-[var(--template-text-secondary)] leading-relaxed pt-1">{step}</p>
                      </li>
                  ))}
                </ul>
              </motion.aside>

              {data.faqItems.length > 0 && (
                  <motion.aside
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                    className="rounded-3xl border border-[var(--template-border-soft)] bg-[var(--template-surface-glass)] p-8 h-fit shadow-[var(--template-depth-sm)] backdrop-blur-md"
                  >
                    <h3 className="text-xl font-semibold text-[var(--template-text-primary)] mb-6">{data.faqTitle}</h3>
                    <div className="space-y-6">
                      {data.faqItems.map((item, idx) => (
                          <div key={idx}>
                              <h4 className="font-medium text-[var(--template-text-primary)] mb-2">{item.question}</h4>
                              <SafeRichText as="p" value={item.answer} className="text-sm text-[var(--template-text-secondary)] leading-relaxed" />
                          </div>
                      ))}
                    </div>
                  </motion.aside>
              )}
          </div>
        </div>
      </div>
      {/* Author-added blocks rendered after the bespoke contact composition. */}
      <ExtraBlocksTail pageKind="contact" visualLayout={visualLayout} locale={locale} />
    </section>
  );
}
