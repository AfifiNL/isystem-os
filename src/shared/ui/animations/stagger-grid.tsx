"use client";
import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface StaggerGridProps {
    children: ReactNode;
    className?: string;
    stagger?: number;
    y?: number;
    duration?: number;
}

export function StaggerGrid({
    children,
    className = "",
    stagger = 0.12,
    y = 40,
    duration = 0.6,
}: StaggerGridProps) {
    const ref = useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            if (!ref.current) return;
            const items = ref.current.children;
            if (!items.length) return;

            gsap.fromTo(items, {
                y,
                autoAlpha: 0,
            }, {
                y: 0,
                autoAlpha: 1,
                duration,
                stagger,
                ease: "power3.out",
                scrollTrigger: {
                    trigger: ref.current,
                    start: "top 85%",
                },
            });
        },
        { scope: ref }
    );

    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    );
}
