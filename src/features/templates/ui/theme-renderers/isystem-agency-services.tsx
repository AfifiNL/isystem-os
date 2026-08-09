"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { useScrollReveal } from "@/shared/lib/gsap/use-scroll-reveal";
import { buildIsystemServicesPageData } from "./isystem-agency-renderer-data";
import type { Json } from "@/shared/lib/supabase/database.types";
import { SafeRichText } from "@/shared/ui/safe-rich-text";
import { ExtraBlocksTail } from "@/features/templates/ui/extra-blocks-tail";

interface ThemeSubPageProps {
  config: TemplateConfig;
  dictionary: Record<string, string>;
  locale: Locale;
  visualLayout?: Json | null;
}

export default function IsystemAgencyServices({ config, locale, visualLayout }: ThemeSubPageProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  useScrollReveal(rootRef, { y: 32, stagger: 0.1 });

  const isNl = locale === "nl";
  const isAr = locale === "ar";
  const resolvedLocale = (isNl ? "nl" : (isAr ? "ar" : "en")) as "en" | "nl" | "ar";

  const data = buildIsystemServicesPageData(config, resolvedLocale, visualLayout);

  const tiers = isNl
    ? [
        ["Basic", "Uw digitale fundament", "Een professionele aanwezigheid met de essentiële systemen om gevonden te worden en vertrouwen te wekken."],
        ["Pro", "Uw digitaal besturingssysteem", "Een volledige cockpit voor groei en operatie, inclusief AI-drafting, media workflows en SLA-tracking."],
      ]
    : [
        ["Basic", "Your digital foundation", "A professional presence with the essential systems to be found and build trust."],
        ["Pro", "Your digital operating system", "A full growth and operations cockpit, including AI drafting, media workflows, and SLA tracking."],
      ];

  return (
    <section ref={rootRef} className="bg-[linear-gradient(180deg,oklch(0.965_0.025_248)_0%,oklch(0.92_0.044_246)_44%,oklch(0.955_0.022_248)_100%)] py-20 text-[var(--template-text-primary)] md:py-32 relative overflow-hidden min-h-screen">
      {/* Light public theme background effects */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-[-10%] h-[560px] w-[560px] rounded-full bg-[color-mix(in_oklch,var(--template-primary)_14%,transparent)] opacity-80 blur-[130px]" />
          <div className="absolute bottom-1/4 right-[-8%] h-[640px] w-[640px] rounded-full bg-[color-mix(in_oklch,var(--template-accent)_18%,transparent)] opacity-70 blur-[160px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(27,87,143,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(27,87,143,0.045)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_78%_54%_at_50%_38%,#000_62%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(12,24,42,0.06),transparent_38%,rgba(191,141,33,0.06))]" />
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

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {data.offerings.map((offering, idx) => (
            <motion.article
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 + 0.2 }}
              className="relative rounded-3xl border border-[var(--template-border-soft)] bg-[var(--template-surface-glass)] p-8 backdrop-blur-xl shadow-[var(--template-depth-sm)] overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-amber-300/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className="text-6xl font-bold text-[var(--template-primary)]">{String(idx + 1).padStart(2, '0')}</span>
              </div>
              <h2 className="text-2xl font-semibold text-[var(--template-text-primary)] mb-4 relative z-10">{offering.title}</h2>
              <SafeRichText as="p" value={offering.description} className="text-[var(--template-text-secondary)] leading-relaxed relative z-10" />
            </motion.article>
          ))}
        </div>

        <div className="mt-24">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-[var(--template-text-primary)] mb-8"
          >
            {isAr ? "خيارات مساحة العمل" : isNl ? "Workspace opties" : "Workspace options"}
          </motion.h2>
          <div className="grid gap-6 md:grid-cols-2">
            {tiers.map(([tier, subtitle, details], idx) => (
              <motion.div
                key={tier}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className={`rounded-3xl border p-8 relative overflow-hidden ${
                    tier === "Pro"
                    ? "border-[var(--template-border-accent-soft)] bg-[linear-gradient(135deg,color-mix(in_oklch,var(--template-accent)_14%,oklch(0.988_0.01_248)),color-mix(in_oklch,var(--template-primary)_8%,oklch(0.972_0.014_246)))]"
                    : "border-[var(--template-border-soft)] bg-[var(--template-surface-glass)]"
                }`}
              >
                {tier === "Pro" && (
                    <div className="absolute top-0 right-0 px-4 py-1 bg-[color-mix(in_oklch,var(--template-accent)_16%,oklch(0.988_0.01_248))] border-b border-s border-[var(--template-border-accent-soft)] rounded-bl-xl text-xs font-bold text-[var(--template-text-accent-strong)] uppercase tracking-wider">
                        Recommended
                    </div>
                )}
                <p className={`text-sm font-bold uppercase tracking-wider mb-3 ${tier === "Pro" ? "text-[var(--template-text-accent-strong)]" : "text-[var(--template-primary)]"}`}>{tier}</p>
                <h3 className="text-2xl font-semibold text-[var(--template-text-primary)] mb-4">{subtitle}</h3>
                <p className="text-[var(--template-text-secondary)] leading-relaxed">{details}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-24">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-[var(--template-text-primary)] mb-4"
          >
            {data.methodologyTitle}
          </motion.h2>
          {data.methodologySubtitle && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <SafeRichText as="p" value={data.methodologySubtitle} className="text-lg text-[var(--template-text-secondary)] mb-8" />
              </motion.div>
          )}
          <div className="grid gap-6 md:grid-cols-3">
            {data.engagementModels.map((model, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="rounded-2xl border border-[var(--template-border-soft)] bg-[var(--template-surface-glass)] p-8 shadow-[var(--template-depth-sm)] backdrop-blur-md hover:[background:var(--template-surface-light)] transition-colors"
              >
                {model.tier && <p className="text-sm font-bold uppercase tracking-wider text-[var(--template-primary)] mb-3">{model.tier}</p>}
                <h3 className="font-semibold text-[var(--template-text-primary)] text-lg mb-3">{model.title}</h3>
                <SafeRichText as="p" value={model.description} className="text-sm text-[var(--template-text-secondary)] leading-relaxed" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      {/* Author-added blocks rendered after the bespoke services composition. */}
      <ExtraBlocksTail pageKind="services" visualLayout={visualLayout} locale={locale} />
    </section>
  );
}
