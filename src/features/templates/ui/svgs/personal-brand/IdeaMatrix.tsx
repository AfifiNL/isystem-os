import * as React from "react";

export function IdeaMatrix({ className = "" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`w-full h-full text-stone-400 ${className}`}
        >
            {/* Grid Dots */}
            <g className="idea-matrix-dots opacity-30">
                {[10, 30, 50, 70, 90].map((x) =>
                    [10, 30, 50, 70, 90].map((y) => (
                        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="currentColor" />
                    ))
                )}
            </g>

            {/* Matrix Lines */}
            <path
                d="M30 30 L 70 70 M 30 70 L 70 30 M 50 10 L 50 90 M 10 50 L 90 50"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="idea-matrix-lines opacity-60"
            />

            {/* Central Node */}
            <circle cx="50" cy="50" r="6" fill="currentColor" className="idea-matrix-core" />
            <circle cx="50" cy="50" r="12" stroke="currentColor" strokeWidth="2" className="idea-matrix-pulse opacity-50" />
        </svg>
    );
}
