"use client";
import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface TextRevealProps {
    children: ReactNode;
    className?: string;
    as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
    delay?: number;
    duration?: number;
    stagger?: number;
}

export function TextReveal({
    children,
    className = "",
    as: Tag = "h2",
    delay = 0,
    duration = 0.7,
    stagger = 0.03,
}: TextRevealProps) {
    const ref = useRef<HTMLElement>(null);

    useGSAP(
        () => {
            if (!ref.current) return;
            const text = ref.current.textContent || "";
            ref.current.innerHTML = "";

            // Wrap each word
            const words = text.split(" ");
            words.forEach((word, i) => {
                const wordSpan = document.createElement("span");
                wordSpan.style.display = "inline-block";
                wordSpan.style.overflow = "hidden";
                wordSpan.style.verticalAlign = "top";

                const inner = document.createElement("span");
                inner.textContent = word;
                inner.style.display = "inline-block";
                inner.className = "text-reveal-word";

                wordSpan.appendChild(inner);
                ref.current!.appendChild(wordSpan);

                if (i < words.length - 1) {
                    ref.current!.appendChild(document.createTextNode("\u00A0"));
                }
            });

            gsap.fromTo(".text-reveal-word", {
                y: "110%",
            }, {
                y: "0%",
                duration,
                delay,
                stagger,
                ease: "power4.out",
                scrollTrigger: {
                    trigger: ref.current,
                    start: "top 85%",
                },
            });
        },
        { scope: ref }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Tag ref={ref as any} className={className}>{children}</Tag>;
}
