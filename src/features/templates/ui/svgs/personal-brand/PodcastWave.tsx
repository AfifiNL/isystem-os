import * as React from "react";

export function PodcastWave({ className = "" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`w-full h-full text-amber-500 ${className}`}
        >
            <path
                d="M10 50 Q 25 20, 50 50 T 90 50"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                className="podcast-wave-path-1 opacity-80"
            />
            <path
                d="M10 50 Q 25 80, 50 50 T 90 50"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                className="podcast-wave-path-2 opacity-60"
            />
            <path
                d="M20 50 Q 35 10, 50 50 T 80 50"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="podcast-wave-path-3 opacity-40"
            />
        </svg>
    );
}
