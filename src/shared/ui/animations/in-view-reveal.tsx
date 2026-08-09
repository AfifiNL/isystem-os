"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface InViewRevealProps {
    children: ReactNode;
    className?: string;
    delayMs?: number;
}

export function InViewReveal({ children, className, delayMs = 0 }: InViewRevealProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry?.isIntersecting) return;
                setVisible(true);
                observer.unobserve(node);
            },
            {
                threshold: 0.25,
                rootMargin: "0px 0px -8% 0px",
            },
        );

        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={cn(
                "transition-[opacity,transform] duration-500 ease-[var(--template-motion-ease-emphasis)]",
                visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
                className,
            )}
            style={{ transitionDelay: `${delayMs}ms` }}
        >
            {children}
        </div>
    );
}
