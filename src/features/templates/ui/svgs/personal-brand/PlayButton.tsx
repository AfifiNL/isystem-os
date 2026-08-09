import * as React from "react";

export function PlayButton({ className = "" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`w-full h-full ${className}`}
        >
            {/* Radiating signal rings */}
            <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="1" className="play-ring opacity-10" />
            <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="1" className="play-ring opacity-15" />
            <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="1.5" className="play-ring opacity-20" />

            {/* Play button circle */}
            <circle cx="50" cy="50" r="20" fill="currentColor" className="play-bg opacity-90" />

            {/* Play triangle */}
            <polygon
                points="44,38 44,62 64,50"
                fill="white"
                className="play-icon"
            />
        </svg>
    );
}
