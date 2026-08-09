import * as React from "react";

export function CircuitBoard({ className = "" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`w-full h-full ${className}`}
        >
            {/* Horizontal traces */}
            <g className="circuit-traces opacity-20" stroke="currentColor" strokeWidth="1">
                <line x1="0" y1="40" x2="200" y2="40" />
                <line x1="0" y1="80" x2="200" y2="80" />
                <line x1="0" y1="120" x2="200" y2="120" />
                <line x1="0" y1="160" x2="200" y2="160" />
            </g>

            {/* Vertical traces */}
            <g className="circuit-traces opacity-20" stroke="currentColor" strokeWidth="1">
                <line x1="40" y1="0" x2="40" y2="200" />
                <line x1="80" y1="0" x2="80" y2="200" />
                <line x1="120" y1="0" x2="120" y2="200" />
                <line x1="160" y1="0" x2="160" y2="200" />
            </g>

            {/* Signal paths — diagonal orchestration routes */}
            <path
                d="M40 40 L80 80 L120 80 L160 40"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="circuit-signal opacity-40"
            />
            <path
                d="M40 160 L80 120 L120 120 L160 160"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="circuit-signal opacity-40"
            />
            <path
                d="M80 80 L80 120"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="circuit-signal opacity-40"
            />
            <path
                d="M120 80 L120 120"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="circuit-signal opacity-40"
            />

            {/* Junction nodes */}
            {[
                [40, 40], [80, 40], [120, 40], [160, 40],
                [40, 80], [80, 80], [120, 80], [160, 80],
                [40, 120], [80, 120], [120, 120], [160, 120],
                [40, 160], [80, 160], [120, 160], [160, 160],
            ].map(([x, y]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="currentColor" className="circuit-node opacity-30" />
            ))}

            {/* Primary nodes — the orchestrator hubs */}
            <circle cx="80" cy="80" r="6" fill="currentColor" className="circuit-hub opacity-60" />
            <circle cx="120" cy="80" r="6" fill="currentColor" className="circuit-hub opacity-60" />
            <circle cx="80" cy="120" r="6" fill="currentColor" className="circuit-hub opacity-60" />
            <circle cx="120" cy="120" r="6" fill="currentColor" className="circuit-hub opacity-60" />

            {/* Central orchestrator */}
            <circle cx="100" cy="100" r="10" fill="currentColor" className="circuit-core opacity-70" />
            <circle cx="100" cy="100" r="16" stroke="currentColor" strokeWidth="1.5" className="circuit-pulse opacity-30" />
            <circle cx="100" cy="100" r="24" stroke="currentColor" strokeWidth="1" className="circuit-pulse opacity-15" />
        </svg>
    );
}
