"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function PublicPageMotionController() {
    const markerRef = useRef<HTMLSpanElement | null>(null);

    useGSAP(() => {
        const root = markerRef.current?.closest(".isystem-public-renderer") as HTMLElement | null;
        if (!root) return;

        const motionPreference = gsap.matchMedia();

        motionPreference.add("(prefers-reduced-motion: no-preference)", () => {
            const hero = root.querySelector<HTMLElement>(".isystem-public-hero");

            if (hero) {
                const heroCopy = hero.querySelectorAll<HTMLElement>("[data-public-hero-copy] > *");
                const heroEvidence = hero.querySelector<HTMLElement>("[data-public-hero-evidence]");
                const intro = gsap.timeline({ defaults: { ease: "power2.out" } });

                intro
                    .from(heroCopy, {
                        autoAlpha: 0,
                        y: 22,
                        duration: 0.72,
                        stagger: 0.085,
                    })
                    .from(heroEvidence, {
                        autoAlpha: 0,
                        y: 28,
                        scale: 0.985,
                        duration: 0.82,
                    }, "-=0.46");
            }

            root.querySelectorAll<HTMLElement>(".isystem-public-section:not(.isystem-public-hero)").forEach((section) => {
                const container = section.querySelector<HTMLElement>(".isystem-public-container");
                if (!container) return;

                const stagedItems = section.querySelectorAll<HTMLElement>("[data-public-card], [data-public-step]");
                const timeline = gsap.timeline({
                    scrollTrigger: {
                        trigger: section,
                        start: "top 90%",
                        end: "top 56%",
                        scrub: 0.7,
                        invalidateOnRefresh: true,
                    },
                });

                timeline.fromTo(container, {
                    autoAlpha: 0.88,
                    y: 22,
                }, {
                    autoAlpha: 1,
                    y: 0,
                    duration: 1,
                    ease: "none",
                });

                if (stagedItems.length > 0) {
                    timeline.fromTo(stagedItems, {
                        y: 10,
                    }, {
                        y: 0,
                        duration: 0.72,
                        stagger: 0.055,
                        ease: "none",
                    }, 0.16);
                }
            });

            ScrollTrigger.refresh();
        });

        return () => motionPreference.revert();
    }, []);

    return <span ref={markerRef} className="sr-only" aria-hidden="true" />;
}
