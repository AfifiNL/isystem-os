"use client";

import type { ReactNode } from "react";

interface FilterChipProps {
    active: boolean;
    onClick: () => void;
    label: ReactNode;
    className?: string;
}

export function FilterChip({ active, onClick, label, className = "" }: FilterChipProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
            } ${className}`}
        >
            {label}
        </button>
    );
}

interface SegmentedControlProps<T extends string> {
    value: T;
    onChange: (v: T) => void;
    options: Array<{ value: T; label: ReactNode }>;
    className?: string;
}

export function SegmentedControl<T extends string>({
    value,
    onChange,
    options,
    className = "",
}: SegmentedControlProps<T>) {
    return (
        <div className={`inline-flex overflow-hidden rounded-md border border-border/60 bg-background/60 text-xs ${className}`}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    aria-pressed={value === opt.value}
                    className={`px-3 py-1.5 transition-colors ${
                        value === opt.value
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

interface SearchInputProps {
    value: string;
    onSubmit: (value: string) => void;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function SearchInput({
    value,
    onChange,
    onSubmit,
    placeholder = "Search…",
    className = "",
}: SearchInputProps) {
    return (
        <div className={`relative flex-1 min-w-[200px] ${className}`}>
            <svg
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
            >
                <circle cx={11} cy={11} r={7} />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") onSubmit(value);
                }}
                onBlur={() => onSubmit(value)}
                placeholder={placeholder}
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    );
}
