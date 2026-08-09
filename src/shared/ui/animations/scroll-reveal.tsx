"use client";
import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface ScrollRevealProps {
    children: ReactNode;
    className?: string;
    delay?: number;
    y?: number;
    duration?: number;
    start?: string;
}

export function ScrollReveal({
    children,
    className = "",
    delay = 0,
    y = 50,
    duration = 0.8,
    start = "top 88%",
}: ScrollRevealProps) {
    const ref = useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            if (!ref.current) return;
            gsap.fromTo(
                ref.current,
                { y, autoAlpha: 0 },
                {
                    y: 0,
                    autoAlpha: 1,
                    duration,
                    delay,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: ref.current,
                        start,
                    },
                }
            );
        },
        { scope: ref }
    );

    return (
        <div ref={ref} className={className} style={{ visibility: "hidden" }}>
            {children}
        </div>
    );
}
