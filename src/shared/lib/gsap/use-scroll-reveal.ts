"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useScrollReveal(
    containerRef: React.RefObject<HTMLElement | null>,
    options?: { stagger?: number; y?: number; duration?: number; start?: string }
) {
    useGSAP(
        () => {
            const elements = containerRef.current?.querySelectorAll("[data-animate]");
            if (!elements?.length) return;

            elements.forEach((el, i) => {
                gsap.from(el, {
                    y: options?.y ?? 60,
                    autoAlpha: 0,
                    duration: options?.duration ?? 0.8,
                    delay: (options?.stagger ?? 0.1) * i,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: el,
                        start: options?.start ?? "top 85%",
                    },
                });
            });
        },
        { scope: containerRef }
    );
}
