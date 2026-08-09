import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export function GearSystemSvg({ className }: { className?: string }) {
    const containerRef = useRef<SVGSVGElement>(null);

    useGSAP(() => {
        if (!containerRef.current) return;

        gsap.to(".gear-main", {
            rotation: 360,
            duration: 20,
            repeat: -1,
            ease: "none",
            transformOrigin: "40px 40px"
        });

        gsap.to(".gear-secondary", {
            rotation: -360,
            duration: 15,
            repeat: -1,
            ease: "none",
            transformOrigin: "70px 70px"
        });

        gsap.to(".gear-belt", {
            strokeDashoffset: -20,
            duration: 2,
            repeat: -1,
            ease: "none"
        });
    }, { scope: containerRef });

    return (
        <svg
            ref={containerRef}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Main Gear */}
            <g className="gear-main" style={{ transformOrigin: '40px 40px' }}>
                <circle cx="40" cy="40" r="20" stroke="currentColor" strokeWidth="3" />
                <circle cx="40" cy="40" r="8" stroke="currentColor" strokeWidth="2" />
                {/* Teeth */}
                <path d="M37 15V10H43V15 M37 65V70H43V65 M15 37H10V43H15 M65 37H70V43H65 M24 24L20 20L24 16L28 20 M56 56L60 60L56 64L52 60 M24 56L20 60L16 56L20 52 M56 24L60 20L64 24L60 28" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </g>

            {/* Secondary Gear */}
            <g className="gear-secondary" style={{ transformOrigin: '70px 70px' }}>
                <circle cx="70" cy="70" r="14" stroke="currentColor" strokeWidth="2.5" />
                <circle cx="70" cy="70" r="5" stroke="currentColor" strokeWidth="1.5" />
                {/* Teeth */}
                <path d="M68 53V49H72V53 M68 87V91H72V87 M53 68H49V72H53 M87 68H91V72H87 M60 60L57 57L60 54L63 57 M80 80L83 83L80 86L77 83 M60 80L57 83L54 80L57 77 M80 60L83 57L86 60L83 63" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </g>

            {/* Connection / Belt */}
            <path d="M20 40A30 30 0 0 0 60 70" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="gear-belt" />
        </svg>
    );
}
