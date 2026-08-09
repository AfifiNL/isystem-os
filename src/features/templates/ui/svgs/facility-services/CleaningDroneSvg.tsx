import React from "react";

export function CleaningDroneSvg({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Drone Body */}
            <path
                d="M30 40C30 30 70 30 70 40V50C70 60 30 60 30 50V40Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                className="drone-body"
            />
            {/* Rotor Left */}
            <path d="M20 35L40 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="drone-rotor-arm-left" />
            <ellipse cx="30" cy="25" rx="15" ry="3" stroke="currentColor" strokeWidth="1.5" className="drone-propeller-left" />
            {/* Rotor Right */}
            <path d="M80 35L60 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="drone-rotor-arm-right" />
            <ellipse cx="70" cy="25" rx="15" ry="3" stroke="currentColor" strokeWidth="1.5" className="drone-propeller-right" />

            {/* Cleaning Beam / Scanner */}
            <path d="M35 55L25 85H75L65 55" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="drone-scanner-beam" />
            {/* Core Eye / Sensor */}
            <circle cx="50" cy="45" r="4" stroke="currentColor" strokeWidth="2" className="drone-sensor-eye" />
            <path d="M40 45H42 M58 45H60" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="drone-vents" />
        </svg>
    );
}
