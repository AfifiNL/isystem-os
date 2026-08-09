"use client";

import { useRef } from "react";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { useGSAP } from "@gsap/react";
import { scrubReveal, scrubCards } from "@/features/templates/ui/theme-renderers/gsap-utils";
import { PodcastWave } from "@/features/templates/ui/svgs/personal-brand/PodcastWave";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

interface ThemeSubPageProps {
  config: TemplateConfig;
  dictionary: Record<string, string>;
  locale: Locale;
}

export default function PersonalBrandServices({ config, locale }: ThemeSubPageProps) {
  const containerRef = useRef<HTMLElement | null>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    scrubReveal(
      containerRef.current,
      ".service-header-elem",
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1 },
      { startOffset: "top 90%", endOffset: "top 30%", stagger: 0.1 }
    );

    const gridSection = containerRef.current.querySelector("#pb-service-grid");
    if (gridSection) {
      scrubCards(gridSection, ".service-grid-card", {
        y: 50,
        startOffset: "top 85%",
        endOffset: "top 20%",
        stagger: 0.15
      });
    }

  }, { scope: containerRef });

  const services = config.pages.services;

  return (
    <section ref={containerRef} className="bg-stone-50 py-20 md:py-32 border-t border-amber-100/50">
      <div className="container mx-auto max-w-6xl px-6">
        <header className="max-w-3xl text-center mx-auto mb-20 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-16 w-32 h-32 text-amber-200 opacity-50 z-0">
            <PodcastWave />
          </div>
          <div className="relative z-10">
            <p className="service-header-elem text-sm font-bold uppercase tracking-[0.2em] text-amber-600 mb-4">
              {pickLocaleText(services?.title, locale, "Ways we can collaborate")}
            </p>
            <h1 className="service-header-elem text-4xl md:text-5xl font-serif font-bold text-stone-900 leading-tight mb-6">
              {pickLocaleText(services?.subtitle, locale, "Expertise & Offerings")}
            </h1>
            <p className="service-header-elem text-xl text-stone-600 max-w-2xl mx-auto">
              {pickLocaleText(services?.description, locale, "Whether through speaking, consulting, or hands-on building, I bring energy and structural clarity to your visions.")}
            </p>
          </div>
        </header>

        <div id="pb-service-grid" className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["Keynote Speaking", "Inspire your team or event attendees with high-energy talks on the future of AI formulation and brand empathy."],
            ["Strategic Advising", "Monthly advisory retainers to help executives navigate technical roadmaps without losing the human touch."],
            ["Vibe Coding Workshops", "Intensive hands-on sessions showing product teams how to infuse emotional intelligence into digital UX."],
            ["Brand Architecture", "End-to-end consulting to align your visual identity, copy, and product behavior."],
            ["Podcast Guesting", "Bringing fresh insights, humor, and vulnerable storytelling to your audience's ears."],
            ["Fractional Leadership", "For startups looking for temporary visionary leadership to guide engineering and creative teams."]
          ].map(([title, body], i) => (
            <article
              key={i}
              className="service-grid-card rounded-3xl bg-white border border-amber-100 p-8 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all duration-300 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 -me-8 -mt-8 bg-amber-50 rounded-full scale-0 group-hover:scale-150 transition-transform duration-500 ease-out z-0" />
              <div className="relative z-10">
                <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">{title}</h2>
                <p className="text-stone-600 leading-relaxed">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
