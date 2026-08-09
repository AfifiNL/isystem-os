import * as React from "react";

export function GrowthLoop({ className = "" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`w-full h-full text-amber-500 ${className}`}
        >
            <path
                d="M 20 60 C 20 20, 80 20, 80 60 C 80 100, 20 100, 20 60"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                className="growth-loop-path opacity-80"
                strokeDasharray="200"
                strokeDashoffset="0"
            />

            <circle cx="80" cy="60" r="4" fill="currentColor" className="growth-loop-node-1" />
            <circle cx="50" cy="27" r="5" fill="currentColor" className="growth-loop-node-2" />
            <circle cx="20" cy="60" r="4" fill="currentColor" className="growth-loop-node-3" />

            <path
                d="M 50 27 L 50 10 M 80 60 L 95 60 M 20 60 L 5 60"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="growth-loop-rays opacity-40"
            />
        </svg>
    );
}
