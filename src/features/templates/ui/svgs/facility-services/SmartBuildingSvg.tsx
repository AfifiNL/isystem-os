import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export function SmartBuildingSvg({ className }: { className?: string }) {
  const containerRef = useRef<SVGSVGElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    gsap.to(".building-node", {
      opacity: 0.3,
      scale: 0.85,
      duration: 1.5,
      stagger: {
        each: 0.2,
        yoyo: true,
        repeat: -1
      },
      ease: "power1.inOut",
      transformOrigin: "center"
    });

    gsap.to(".building-connections", {
      strokeDashoffset: -10,
      duration: 3,
      repeat: -1,
      ease: "none"
    });

    gsap.fromTo(".building-signal-1, .building-signal-2",
      { opacity: 0, scale: 0.8 },
      {
        opacity: 1,
        scale: 1.2,
        duration: 2,
        stagger: 0.5,
        repeat: -1,
        ease: "power2.out",
        transformOrigin: "50px 10px"
      }
    );
  }, { scope: containerRef });

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Base Building Structure */}
      <path
        d="M20 90V30L50 10L80 30V90H20Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        className="building-outline"
      />
      {/* Grid Windows / Nodes */}
      <rect x="30" y="40" width="10" height="10" stroke="currentColor" strokeWidth="1.5" className="building-node building-node-1" />
      <rect x="60" y="40" width="10" height="10" stroke="currentColor" strokeWidth="1.5" className="building-node building-node-2" />
      <rect x="30" y="60" width="10" height="10" stroke="currentColor" strokeWidth="1.5" className="building-node building-node-3" />
      <rect x="60" y="60" width="10" height="10" stroke="currentColor" strokeWidth="1.5" className="building-node building-node-4" />
      {/* Smart Connection Lines */}
      <path
        d="M40 45H60 M40 65H60 M35 50V60 M65 50V60"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 2"
        className="building-connections"
      />
      {/* Entrance */}
      <path
        d="M40 90V75H60V90"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        className="building-door"
      />
      {/* Broadcast Signal Top */}
      <path d="M50 10V2" stroke="currentColor" strokeWidth="2" className="building-signal-base" />
      <path d="M42 5A 10 10 0 0 1 58 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="building-signal-1" />
      <path d="M38 1A 15 15 0 0 1 62 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="building-signal-2" />
    </svg>
  );
}
