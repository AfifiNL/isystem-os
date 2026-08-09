"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { useScrollReveal } from "@/shared/lib/gsap/use-scroll-reveal";

interface ThemeSubPageProps {
  config: TemplateConfig;
  dictionary: Record<string, string>;
  locale: Locale;
}

export default function SaasProductContact({ config, locale }: ThemeSubPageProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  useScrollReveal(sectionRef, { y: 30, stagger: 0.1 });

  const contact = config.pages.contact;

  return (
    <section ref={sectionRef} className="bg-slate-950 py-14 text-slate-100 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.header initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">{contact.title[locale]}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold md:text-5xl">{contact.subtitle[locale]}</h1>
          <p data-animate className="mt-4 max-w-3xl text-slate-300">Book a product demo and share your use case. We tailor the walkthrough to your workflows, team structure, and integration requirements.</p>
        </motion.header>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <form data-animate className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold">Request a Demo</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" placeholder="Work email" />
              <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" placeholder="Company" />
              <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" placeholder="Team size" />
              <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" placeholder="Current stack" />
            </div>
            <textarea className="mt-4 min-h-28 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" placeholder="Primary use case, goals, and timeline" />
            <button type="button" className="mt-4 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Schedule Demo</button>
          </form>

          <aside data-animate className="rounded-2xl border border-cyan-900 bg-cyan-950/40 p-6">
            <h3 className="font-semibold">What happens next</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>• 30-min tailored walkthrough</li>
              <li>• Security + integration review</li>
              <li>• Recommended rollout plan</li>
              <li>• Optional pilot workspace setup</li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}

