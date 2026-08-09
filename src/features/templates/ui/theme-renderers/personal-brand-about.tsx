"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import Image from "next/image";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { scrubReveal, scrubTimeline } from "@/features/templates/ui/theme-renderers/gsap-utils";
import { GrowthLoop } from "@/features/templates/ui/svgs/personal-brand/GrowthLoop";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

interface ThemeSubPageProps {
  config: TemplateConfig;
  dictionary: Record<string, string>;
  locale: Locale;
}

export default function PersonalBrandAbout({ config, locale }: ThemeSubPageProps) {
  const containerRef = useRef<HTMLElement | null>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    // Header Reveal
    scrubReveal(
      containerRef.current,
      ".about-header-item",
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1 },
      { startOffset: "top 90%", endOffset: "top 20%", stagger: 0.1 }
    );

    // Timeline for the main content split
    const contentSplit = containerRef.current.querySelector("#pb-about-content");
    if (contentSplit) {
      const tl = scrubTimeline(contentSplit, { startOffset: "top 85%", endOffset: "center center" });
      tl.fromTo(
        contentSplit.querySelector(".about-visual"),
        { opacity: 0, x: -50 },
        { opacity: 1, x: 0 }
      );
      tl.fromTo(
        contentSplit.querySelectorAll(".about-text"),
        { opacity: 0, x: 50 },
        { opacity: 1, x: 0, stagger: 0.15 },
        "<0.2"
      );
    }
  }, { scope: containerRef });

  const about = config.pages.about;

  return (
    <section ref={containerRef} className="bg-amber-50/20 py-20 md:py-32 overflow-hidden">
      <div className="container mx-auto max-w-5xl px-6">
        <header className="mb-20 text-center max-w-3xl mx-auto">
          <p className="about-header-item text-sm font-bold uppercase tracking-[0.2em] text-amber-600 mb-4">
            {pickLocaleText(about?.title, locale, "About Me")}
          </p>
          <h1 className="about-header-item text-4xl md:text-6xl font-serif font-bold text-stone-900 leading-tight">
            {pickLocaleText(about?.headline, locale, "Meet the person behind the work.")}
          </h1>
        </header>

        <div id="pb-about-content" className="grid gap-16 md:grid-cols-2 items-center">
          {/* Visual Column */}
            <div className="about-visual relative">
              <div className="aspect-[3/4] rounded-[3rem] overflow-hidden shadow-2xl shadow-amber-900/10 border-4 border-white bg-white">
              <Image
                src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&q=80"
                alt="Portrait"
                width={800}
                height={1067}
                className="w-full h-full object-cover"
              />
            </div>
            {/* SVG Decoration */}
            <div className="absolute -bottom-10 -right-10 w-48 h-48 text-amber-400 opacity-60 z-[-1]">
              <GrowthLoop />
            </div>
          </div>

          {/* Text Column */}
          <div className="space-y-6">
            <h2 className="about-text text-2xl font-serif font-bold text-stone-900">
              The Story Behind the Brand
            </h2>
            <p className="about-text text-lg text-stone-600 leading-relaxed">
              {pickLocaleText(about?.description, locale, "I help industry professionals become strategic orchestrators — building powerful AI-driven products and content systems.")}
            </p>
            <p className="about-text text-lg text-stone-600 leading-relaxed">
              What started as a simple passion for coding evolved into a mission to bring joy back to digital creation.
              I believe the best products aren&apos;t just functional—they feel alive, empathetic, and premium.
            </p>
            <div className="about-text pt-6 border-t border-amber-100">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-3xl font-serif font-bold text-amber-600">10+</p>
                  <p className="text-sm font-medium text-stone-500 uppercase tracking-widest mt-1">Years Building</p>
                </div>
                <div>
                  <p className="text-3xl font-serif font-bold text-amber-600">50k+</p>
                  <p className="text-sm font-medium text-stone-500 uppercase tracking-widest mt-1">Community</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
