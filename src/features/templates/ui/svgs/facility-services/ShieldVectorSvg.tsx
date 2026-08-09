import React from "react";

export function ShieldVectorSvg({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Shield Outline */}
            <path
                d="M50 5L90 20V45C90 65 75 85 50 95C25 85 10 65 10 45V20L50 5Z"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinejoin="round"
                className="shield-outline"
            />
            {/* Inner Shield / Armor Plates */}
            <path
                d="M50 15L80 27V45C80 60 68 76 50 84C32 76 20 60 20 45V27L50 15Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeDasharray="4 2"
                className="shield-inner"
            />
            {/* High-Tech Circuit Lines */}
            <path
                d="M50 15V84"
                stroke="currentColor"
                strokeWidth="1.5"
                className="shield-circuit-vertical"
            />
            <path
                d="M20 45H80"
                stroke="currentColor"
                strokeWidth="1.5"
                className="shield-circuit-horizontal"
            />
            {/* Core Node */}
            <circle cx="50" cy="45" r="5" stroke="currentColor" strokeWidth="2" className="shield-core" />
        </svg>
    );
}
