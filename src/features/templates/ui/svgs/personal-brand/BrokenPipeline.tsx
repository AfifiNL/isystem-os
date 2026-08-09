import * as React from "react";

export function BrokenPipeline({ className = "" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`w-full h-full ${className}`}
        >
            {/* Left pipeline — intact flow */}
            <path
                d="M20 100 L60 100 L60 60 L80 60"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pipeline-intact opacity-40"
            />
            <path
                d="M20 100 L60 100 L60 140 L80 140"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pipeline-intact opacity-40"
            />

            {/* The break — fractured middle section */}
            <path
                d="M80 60 L95 55"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="4 3"
                className="pipeline-broken opacity-60"
            />
            <path
                d="M105 65 L120 60"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="4 3"
                className="pipeline-broken opacity-60"
            />
            <path
                d="M80 140 L95 145"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="4 3"
                className="pipeline-broken opacity-60"
            />
            <path
                d="M105 135 L120 140"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="4 3"
                className="pipeline-broken opacity-60"
            />

            {/* Fracture spark marks */}
            <g className="fracture-sparks opacity-50">
                <line x1="96" y1="48" x2="104" y2="42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="92" y1="52" x2="98" y2="44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="96" y1="148" x2="104" y2="155" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="92" y1="152" x2="98" y2="158" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </g>

            {/* Right pipeline — dangling endpoints */}
            <path
                d="M120 60 L140 60 L140 100 L180 100"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pipeline-dangling opacity-25"
            />
            <path
                d="M120 140 L140 140 L140 100"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pipeline-dangling opacity-25"
            />

            {/* Data flow dots — left side (moving) */}
            <circle cx="30" cy="100" r="3" fill="currentColor" className="data-dot opacity-60" />
            <circle cx="45" cy="100" r="2" fill="currentColor" className="data-dot opacity-40" />
            <circle cx="55" cy="100" r="2" fill="currentColor" className="data-dot opacity-40" />

            {/* Data flow dots — stuck at break */}
            <circle cx="85" cy="58" r="3" fill="currentColor" className="data-stuck opacity-70" />
            <circle cx="85" cy="142" r="3" fill="currentColor" className="data-stuck opacity-70" />

            {/* Input node */}
            <circle cx="20" cy="100" r="6" fill="currentColor" className="node-input opacity-50" />

            {/* Output node — dimmed because unreachable */}
            <circle cx="180" cy="100" r="6" stroke="currentColor" strokeWidth="2" className="node-output opacity-20" />
        </svg>
    );
}
