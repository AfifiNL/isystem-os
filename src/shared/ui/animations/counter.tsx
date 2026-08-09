"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface CounterProps {
    end: number;
    suffix?: string;
    prefix?: string;
    duration?: number;
    className?: string;
}

export function Counter({
    end,
    suffix = "",
    prefix = "",
    duration = 2,
    className = "",
}: CounterProps) {
    const ref = useRef<HTMLSpanElement>(null);

    useGSAP(
        () => {
            if (!ref.current) return;
            const obj = { val: 0 };
            gsap.to(obj, {
                val: end,
                duration,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: ref.current,
                    start: "top 90%",
                },
                onUpdate: () => {
                    if (ref.current) {
                        ref.current.textContent = `${prefix}${Math.round(obj.val)}${suffix}`;
                    }
                },
            });
        },
        { scope: ref }
    );

    return <span ref={ref} className={className}>0</span>;
}
