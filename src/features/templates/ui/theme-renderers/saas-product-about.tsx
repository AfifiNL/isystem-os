"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { useScrollReveal } from "@/shared/lib/gsap/use-scroll-reveal";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

interface ThemeSubPageProps {
  config: TemplateConfig;
  dictionary: Record<string, string>;
  locale: Locale;
}

export default function SaasProductAbout({ config, locale, dictionary }: ThemeSubPageProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  useScrollReveal(rootRef, { y: 40, stagger: 0.1 });

  const about = config.pages.about;
  const stackLabel = dictionary["about.stack"] ?? "Technology stack";

  return (
    <section ref={rootRef} className="bg-slate-950 py-14 text-slate-100 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">{pickLocaleText(about.title, locale)}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold md:text-5xl">{pickLocaleText(about.headline, locale)}</h1>
          <p data-animate className="mt-4 max-w-3xl text-slate-300">{pickLocaleText(about.description, locale)}</p>
        </motion.div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <article data-animate className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Founder Story</h2>
            <p className="mt-3 text-slate-300">Built by two B2B SaaS founders who spent years fighting fragmented ops workflows in scale-ups. We launched to reduce manual reporting and increase execution speed for modern product teams.</p>
          </article>
          <article data-animate className="rounded-2xl border border-cyan-900 bg-cyan-950/40 p-6">
            <h2 className="text-xl font-semibold">Mission</h2>
            <p className="mt-3 text-slate-300">Help teams ship faster with confidence by connecting product analytics, feedback loops, and delivery orchestration in one trusted workspace.</p>
          </article>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Leadership", "Founders from product, engineering, and RevOps with SaaS exits."],
            [stackLabel, "Next.js, TypeScript, Supabase, edge functions, and AI-enabled automation."],
            ["Credentials", "SOC-ready controls, observability-first architecture, and enterprise onboarding playbooks."],
          ].map(([title, content]) => (
            <motion.div
              key={title}
              data-animate
              className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
            >
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-slate-300">{content}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

