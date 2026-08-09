"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface ParallaxImageProps {
    src: string;
    alt: string;
    className?: string;
    speed?: number;
}

export function ParallaxImage({
    src,
    alt,
    className = "",
    speed = 0.3,
}: ParallaxImageProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    useGSAP(
        () => {
            if (!containerRef.current || !imgRef.current) return;
            gsap.to(imgRef.current, {
                yPercent: -20 * speed,
                ease: "none",
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true,
                },
            });
        },
        { scope: containerRef }
    );

    return (
        <div ref={containerRef} className={`overflow-hidden ${className}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                ref={imgRef}
                src={src}
                alt={alt}
                className="w-full h-[120%] object-cover"
                style={{ willChange: "transform" }}
            />
        </div>
    );
}
