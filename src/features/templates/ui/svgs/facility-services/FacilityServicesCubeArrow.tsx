"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface FacilityServicesCubeArrowProps {
    className?: string;
    primaryColor?: string;
    accentColor?: string;
}

/**
 * Facility Services Demo Brand Motif: Geometric cubes arranging into an upward arrow,
 * symbolizing growth, progress, and structured operational systems.
 * Animated with GSAP: cubes fade/slide into position on scroll.
 */
export function FacilityServicesCubeArrow({
    className = "",
    primaryColor = "#002f58",
    accentColor = "#0d4f8c",
}: FacilityServicesCubeArrowProps) {
    const containerRef = useRef<SVGSVGElement>(null);

    useGSAP(
        () => {
            if (!containerRef.current) return;

            const cubes = containerRef.current.querySelectorAll(".cube-group");

            // Respect reduced-motion preference
            if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                gsap.set(cubes, { opacity: 1, y: 0, scale: 1 });
                return;
            }

            // Initial state
            gsap.set(cubes, { opacity: 0, y: 30, scale: 0.6 });

            // Animate each cube in sequentially to form the upward arrow shape
            ScrollTrigger.create({
                trigger: containerRef.current,
                start: "top 60%",
                once: true,
                onEnter: () => {
                    gsap.to(cubes, {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        duration: 0.9,
                        stagger: 0.18,
                        ease: "back.out(1.4)",
                    });
                },
            });

            // Subtle continuous float on the top "cap" cube to indicate pinnacle
            const capCube = containerRef.current.querySelector(".cube-cap");
            if (capCube) {
                gsap.to(capCube, {
                    y: -6,
                    duration: 2.2,
                    ease: "sine.inOut",
                    yoyo: true,
                    repeat: -1,
                    delay: 2,
                });
            }
        },
        { scope: containerRef }
    );

    return (
        <svg
            ref={containerRef}
            viewBox="0 0 200 260"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-label="Facility Services Demo upward arrow motif representing operational growth"
        >
            {/*
             * Facility Services Demo CUBE ARROW MOTIF
             * Structure (bottom to top, forming an arrow pointing up):
             *   Row 5 (base):   col positions 1,2,3,4,5
             *   Row 4:          col positions 2,3,4
             *   Row 3:          col positions 2,3,4 (narrowing)
             *   Row 2 (waist):  col positions 3
             *   Row 1 (cap):    col positions 3 (the apex)
             *
             * The shape forms an upward-pointing arrow from cubes.
             * Each cube is an isometric projection.
             */}

            {/* ── ROW 5 (base - 4 cubes) ── */}
            {/* Cube 5-1 */}
            <g className="cube-group">
                <polygon points="20,175 50,162 80,175 50,188" fill={primaryColor} opacity="0.6" />
                <polygon points="20,175 20,200 50,213 50,188" fill={primaryColor} opacity="0.4" />
                <polygon points="80,175 80,200 50,213 50,188" fill={accentColor} opacity="0.5" />
            </g>
            {/* Cube 5-2 */}
            <g className="cube-group">
                <polygon points="60,155 90,142 120,155 90,168" fill={primaryColor} opacity="0.75" />
                <polygon points="60,155 60,180 90,193 90,168" fill={primaryColor} opacity="0.5" />
                <polygon points="120,155 120,180 90,193 90,168" fill={accentColor} opacity="0.6" />
            </g>
            {/* Cube 5-3 */}
            <g className="cube-group">
                <polygon points="100,155 130,142 160,155 130,168" fill={primaryColor} opacity="0.75" />
                <polygon points="100,155 100,180 130,193 130,168" fill={primaryColor} opacity="0.5" />
                <polygon points="160,155 160,180 130,193 130,168" fill={accentColor} opacity="0.6" />
            </g>
            {/* Cube 5-4 */}
            <g className="cube-group">
                <polygon points="140,175 170,162 200,175 170,188" fill={primaryColor} opacity="0.6" />
                <polygon points="140,175 140,200 170,213 170,188" fill={primaryColor} opacity="0.4" />
                <polygon points="200,175 200,200 170,213 170,188" fill={accentColor} opacity="0.5" />
            </g>

            {/* ── ROW 4 (3 cubes) ── */}
            {/* Cube 4-1 */}
            <g className="cube-group">
                <polygon points="40,130 70,117 100,130 70,143" fill={primaryColor} opacity="0.85" />
                <polygon points="40,130 40,155 70,168 70,143" fill={primaryColor} opacity="0.6" />
                <polygon points="100,130 100,155 70,168 70,143" fill={accentColor} opacity="0.7" />
            </g>
            {/* Cube 4-2 */}
            <g className="cube-group">
                <polygon points="80,110 110,97 140,110 110,123" fill={primaryColor} opacity="0.9" />
                <polygon points="80,110 80,135 110,148 110,123" fill={primaryColor} opacity="0.65" />
                <polygon points="140,110 140,135 110,148 110,123" fill={accentColor} opacity="0.75" />
            </g>
            {/* Cube 4-3 */}
            <g className="cube-group">
                <polygon points="120,130 150,117 180,130 150,143" fill={primaryColor} opacity="0.85" />
                <polygon points="120,130 120,155 150,168 150,143" fill={primaryColor} opacity="0.6" />
                <polygon points="180,130 180,155 150,168 150,143" fill={accentColor} opacity="0.7" />
            </g>

            {/* ── ROW 3 (2 cubes) ── */}
            {/* Cube 3-1 */}
            <g className="cube-group">
                <polygon points="60,87 90,74 120,87 90,100" fill={primaryColor} opacity="0.93" />
                <polygon points="60,87 60,112 90,125 90,100" fill={primaryColor} opacity="0.7" />
                <polygon points="120,87 120,112 90,125 90,100" fill={accentColor} opacity="0.8" />
            </g>
            {/* Cube 3-2 */}
            <g className="cube-group">
                <polygon points="100,87 130,74 160,87 130,100" fill={primaryColor} opacity="0.93" />
                <polygon points="100,87 100,112 130,125 130,100" fill={primaryColor} opacity="0.7" />
                <polygon points="160,87 160,112 130,125 130,100" fill={accentColor} opacity="0.8" />
            </g>

            {/* ── ROW 2 (1 cube) ── */}
            <g className="cube-group">
                <polygon points="80,62 110,49 140,62 110,75" fill={primaryColor} opacity="0.96" />
                <polygon points="80,62 80,87 110,100 110,75" fill={primaryColor} opacity="0.76" />
                <polygon points="140,62 140,87 110,100 110,75" fill={accentColor} opacity="0.85" />
            </g>

            {/* ── ROW 1 (CAP cube — apex) ── */}
            <g className="cube-group cube-cap">
                <polygon points="80,35 110,22 140,35 110,48" fill={primaryColor} />
                <polygon points="80,35 80,62 110,75 110,48" fill={primaryColor} opacity="0.85" />
                <polygon points="140,35 140,62 110,75 110,48" fill={accentColor} opacity="0.95" />
                {/* Highlight edge at apex */}
                <line x1="80" y1="35" x2="110" y2="22" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
                <line x1="110" y1="22" x2="140" y2="35" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
            </g>

            {/* ── Growth lines radiating from cap ── */}
            <g className="cube-group" opacity="0.3">
                <line x1="110" y1="22" x2="110" y2="5" stroke={primaryColor} strokeWidth="2" strokeDasharray="3 3" />
                <line x1="90" y1="28" x2="75" y2="12" stroke={primaryColor} strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="130" y1="28" x2="145" y2="12" stroke={primaryColor} strokeWidth="1.5" strokeDasharray="3 3" />
            </g>
        </svg>
    );
}
