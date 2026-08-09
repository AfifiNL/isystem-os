import * as React from "react";

export function AgentFleet({ className = "" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`w-full h-full ${className}`}
        >
            {/* Connecting paths from central orchestrator to agents */}
            <g className="fleet-connections opacity-25" stroke="currentColor" strokeWidth="1.5">
                <line x1="100" y1="100" x2="50" y2="40" />
                <line x1="100" y1="100" x2="150" y2="40" />
                <line x1="100" y1="100" x2="35" y2="100" />
                <line x1="100" y1="100" x2="165" y2="100" />
                <line x1="100" y1="100" x2="50" y2="160" />
                <line x1="100" y1="100" x2="150" y2="160" />
            </g>

            {/* Inter-agent connections (peer network) */}
            <g className="fleet-peer opacity-15" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3">
                <line x1="50" y1="40" x2="150" y2="40" />
                <line x1="35" y1="100" x2="50" y2="40" />
                <line x1="165" y1="100" x2="150" y2="40" />
                <line x1="35" y1="100" x2="50" y2="160" />
                <line x1="165" y1="100" x2="150" y2="160" />
                <line x1="50" y1="160" x2="150" y2="160" />
            </g>

            {/* Satellite agent nodes */}
            {[
                { cx: 50, cy: 40, r: 10 },
                { cx: 150, cy: 40, r: 10 },
                { cx: 35, cy: 100, r: 10 },
                { cx: 165, cy: 100, r: 10 },
                { cx: 50, cy: 160, r: 10 },
                { cx: 150, cy: 160, r: 10 },
            ].map(({ cx, cy, r }) => (
                <g key={`agent-${cx}-${cy}`}>
                    <circle cx={cx} cy={cy} r={r} fill="currentColor" className="agent-node opacity-40" />
                    <circle cx={cx} cy={cy} r={r + 4} stroke="currentColor" strokeWidth="1" className="agent-ring opacity-20" />
                </g>
            ))}

            {/* Central orchestrator — the Stealth CTO */}
            <circle cx="100" cy="100" r="16" fill="currentColor" className="orchestrator-core opacity-60" />
            <circle cx="100" cy="100" r="22" stroke="currentColor" strokeWidth="2" className="orchestrator-ring opacity-35" />
            <circle cx="100" cy="100" r="30" stroke="currentColor" strokeWidth="1" className="orchestrator-pulse opacity-15" />

            {/* Inner icon — a small command symbol */}
            <path
                d="M94 96 L100 90 L106 96 M94 104 L100 110 L106 104"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="command-icon opacity-80"
                style={{ filter: "brightness(2)" }}
            />
        </svg>
    );
}
