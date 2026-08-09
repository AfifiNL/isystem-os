"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { ExtraBlocksTail } from "@/features/templates/ui/extra-blocks-tail";
import { useScrollReveal } from "@/shared/lib/gsap/use-scroll-reveal";
import { buildIsystemAboutPageData } from "./isystem-agency-renderer-data";
import type { Json } from "@/shared/lib/supabase/database.types";
import { SafeRichText } from "@/shared/ui/safe-rich-text";

interface ThemeSubPageProps {
  config: TemplateConfig;
  dictionary: Record<string, string>;
  locale: Locale;
  visualLayout?: Json | null;
}

export default function IsystemAgencyAbout({ config, locale, visualLayout }: ThemeSubPageProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  useScrollReveal(sectionRef, { y: 28, stagger: 0.1 });

  const isNl = locale === "nl";
  const isAr = locale === "ar";
  const resolvedLocale = (isNl ? "nl" : (isAr ? "ar" : "en")) as "en" | "nl" | "ar";
  
  const data = buildIsystemAboutPageData(config, resolvedLocale, visualLayout);

  return (
    <section ref={sectionRef} className="bg-[linear-gradient(180deg,oklch(0.972_0.018_248)_0%,oklch(0.938_0.032_246)_48%,oklch(0.91_0.045_244)_100%)] py-20 text-[var(--template-text-primary)] md:py-32 relative overflow-hidden min-h-screen">
      {/* Light public theme background effects */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-8%] right-[-8%] h-[650px] w-[650px] rounded-full bg-[color-mix(in_oklch,var(--template-accent)_18%,transparent)] opacity-80 blur-[145px]" />
          <div className="absolute bottom-[-12%] left-[-10%] h-[560px] w-[560px] rounded-full bg-[color-mix(in_oklch,var(--template-primary)_13%,transparent)] opacity-75 blur-[155px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(27,87,143,0.052)_1px,transparent_1px),linear-gradient(90deg,rgba(27,87,143,0.038)_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_76%_52%_at_50%_42%,#000_58%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(150deg,rgba(12,24,42,0.06),transparent_42%,rgba(191,141,33,0.055))]" />
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

        <div className="mt-16 grid gap-6 md:grid-cols-2">
            <motion.article 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="relative rounded-3xl border border-[var(--template-border-soft)] bg-[var(--template-surface-glass)] p-8 backdrop-blur-xl shadow-[var(--template-depth-sm)] overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-amber-300/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <h2 className="text-2xl font-semibold text-[var(--template-text-primary)] mb-4 relative z-10">{data.missionTitle}</h2>
              <SafeRichText as="p" value={data.missionText} className="text-[var(--template-text-secondary)] leading-relaxed relative z-10" />
            </motion.article>
            
            <motion.article 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="relative rounded-3xl border border-[var(--template-border-soft)] bg-[var(--template-surface-glass)] p-8 backdrop-blur-xl shadow-[var(--template-depth-sm)] overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-amber-300/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <h2 className="text-2xl font-semibold text-[var(--template-text-primary)] mb-4 relative z-10">{data.visionTitle}</h2>
              <SafeRichText as="p" value={data.visionText} className="text-[var(--template-text-secondary)] leading-relaxed relative z-10" />
            </motion.article>
        </div>

        <div className="mt-16">
            <h3 className="text-2xl font-bold text-[var(--template-text-primary)] mb-8 text-center">{data.whyTitle}</h3>
            <div className="grid gap-6 md:grid-cols-3">
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
                        transition={{ delay: idx * 0.1 + 0.4 }}
                        className="rounded-2xl border border-[var(--template-border-soft)] bg-[var(--template-surface-glass)] p-8 text-center shadow-[var(--template-depth-sm)] backdrop-blur-md hover:[background:var(--template-surface-light)] transition-colors"
                    >
                        <h3 className="font-semibold text-[var(--template-primary)] text-lg mb-3">{safeTitle}</h3>
                        {description && <p className="text-sm text-[var(--template-text-secondary)] leading-relaxed">{description}</p>}
                    </motion.div>
                );
            })}
            </div>
        </div>
        
        {data.commitmentTitle && data.commitmentDescription && (
            <div className="mt-24 text-center max-w-3xl mx-auto">
                <motion.h3 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-2xl font-bold text-[var(--template-text-primary)] mb-4"
                >
                    {data.commitmentTitle}
                </motion.h3>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                >
                    <SafeRichText as="p" value={data.commitmentDescription} className="text-lg text-[var(--template-text-secondary)] leading-relaxed" />
                </motion.div>
            </div>
        )}
      </div>
      {/* Author-added blocks rendered after the bespoke about composition. */}
      <ExtraBlocksTail pageKind="about" visualLayout={visualLayout} locale={locale} />
    </section>
  );
}
