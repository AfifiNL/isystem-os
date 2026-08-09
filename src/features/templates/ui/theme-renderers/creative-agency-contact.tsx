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

export default function CreativeAgencyContact({ config, locale }: ThemeSubPageProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  useScrollReveal(rootRef, { y: 30, stagger: 0.1 });

  const contact = config.pages.contact;

  return (
    <section ref={rootRef} className="bg-violet-50 py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.header initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">{pickLocaleText(contact.title, locale)}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold text-violet-950 md:text-5xl">{pickLocaleText(contact.subtitle, locale)}</h1>
          <p data-animate className="mt-4 max-w-3xl text-violet-900/80">Share your brand challenge and timeline. We’ll recommend the right strategy/design package and kickoff path.</p>
        </motion.header>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <form data-animate className="rounded-2xl border border-violet-200 bg-white p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-violet-950">Project Brief</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input className="rounded-lg border border-violet-300 px-3 py-2 text-sm" placeholder="Name" />
              <input className="rounded-lg border border-violet-300 px-3 py-2 text-sm" placeholder="Company" />
              <select className="rounded-lg border border-violet-300 px-3 py-2 text-sm">
                <option>Service tier</option>
                <option>Sprint</option>
                <option>Studio</option>
                <option>Scale</option>
              </select>
              <input className="rounded-lg border border-violet-300 px-3 py-2 text-sm" placeholder="Target launch date" />
            </div>
            <textarea className="mt-4 min-h-28 w-full rounded-lg border border-violet-300 px-3 py-2 text-sm" placeholder="Goals, audience, current challenges, and desired deliverables" />
            <button type="button" className="mt-4 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800">Start Conversation</button>
          </form>

          <aside data-animate className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-6">
            <h3 className="font-semibold text-violet-950">Engagement timeline</h3>
            <ul className="mt-3 space-y-2 text-sm text-violet-900/80">
              <li>• Discovery call (30 min)</li>
              <li>• Scope & package recommendation</li>
              <li>• Creative kickoff workshop</li>
              <li>• Production sprints + reviews</li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}

