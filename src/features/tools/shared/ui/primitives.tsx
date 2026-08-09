import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * iSystem public-tools design primitives. Mirror the audit / newsletter /
 * contact dark visual language: slate-950 canvas, cyan/violet atmosphere,
 * rounded-3xl glass panels, rounded-full cyan CTAs, eyebrow pills.
 *
 * Everything renders cleanly in print: dark → white, glass → bordered card,
 * decorative atmosphere hidden via `print:hidden`. Each component pre-bakes
 * the print styles so individual tools never have to think about them.
 */

interface AtmosphereProps {
    className?: string;
}

/** Atmospheric blur backdrop matching the audit page. Render once per page. */
export function ToolAtmosphere({ className }: AtmosphereProps) {
    return (
        <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 -z-10 print:hidden", className)}>
            <div className="absolute -top-40 left-1/4 h-[520px] w-[520px] rounded-full bg-cyan-500/12 blur-[140px] mix-blend-screen" />
            <div className="absolute -bottom-32 right-1/5 h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-[120px] mix-blend-screen" />
            <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                    backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
                    backgroundSize: "32px 32px",
                }}
            />
        </div>
    );
}

interface EyebrowProps {
    icon?: ReactNode;
    children: ReactNode;
    accent?: "cyan" | "violet";
    className?: string;
}

export function ToolEyebrow({ icon, children, accent = "cyan", className }: EyebrowProps) {
    const accentCls = accent === "violet"
        ? "border-violet-400/30 bg-violet-400/10 text-violet-200"
        : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
    return (
        <div
            className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur-md print:hidden",
                accentCls,
                className,
            )}
        >
            {icon}
            {children}
        </div>
    );
}

interface PanelProps {
    children: ReactNode;
    className?: string;
    tone?: "default" | "highlight";
    /** When true the panel is hidden in print output (used for input forms). */
    hideOnPrint?: boolean;
}

/** Glass panel — used for forms, result sections, recommendations. */
export function ToolPanel({ children, className, tone = "default", hideOnPrint = false }: PanelProps) {
    const toneCls = tone === "highlight"
        ? "border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 via-cyan-400/5 to-violet-500/10"
        : "border-white/10 bg-slate-900/70";
    return (
        <div
            className={cn(
                "rounded-3xl border p-6 shadow-[0_30px_80px_rgba(0,15,40,0.5)] backdrop-blur-xl sm:p-8",
                "print:rounded-lg print:border print:border-slate-300 print:bg-white print:p-6 print:shadow-none",
                toneCls,
                hideOnPrint && "print:hidden",
                className,
            )}
        >
            {children}
        </div>
    );
}

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
}

export function ToolPrimaryButton({ children, iconLeft, iconRight, className, ...rest }: PrimaryButtonProps) {
    return (
        <button
            {...rest}
            className={cn(
                "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cyan-500 px-7 text-sm font-semibold text-slate-950",
                "shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)]",
                "focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950",
                "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
                className,
            )}
        >
            {iconLeft}
            {children}
            {iconRight}
        </button>
    );
}

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    iconLeft?: ReactNode;
}

export function ToolSecondaryButton({ children, iconLeft, className, ...rest }: SecondaryButtonProps) {
    return (
        <button
            {...rest}
            className={cn(
                "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium text-white",
                "transition-colors hover:border-cyan-400/40 hover:bg-white/10",
                "focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900",
                "disabled:cursor-not-allowed disabled:opacity-60",
                className,
            )}
        >
            {iconLeft}
            {children}
        </button>
    );
}

interface FieldProps {
    label: string;
    helper?: string;
    htmlFor?: string;
    children: ReactNode;
    className?: string;
}

export function ToolField({ label, helper, htmlFor, children, className }: FieldProps) {
    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <label htmlFor={htmlFor} className="text-xs font-medium text-slate-300">
                {label}
            </label>
            {helper ? <span className="text-[11px] text-slate-400">{helper}</span> : null}
            {children}
        </div>
    );
}

const baseInputCls =
    "h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export function ToolInput({ className, ...rest }: InputProps) {
    return <input {...rest} className={cn(baseInputCls, className)} />;
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;
export function ToolSelect({ className, children, ...rest }: SelectProps) {
    return (
        <select {...rest} className={cn(baseInputCls, "appearance-none pr-9", className)}>
            {children}
        </select>
    );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
export function ToolTextarea({ className, ...rest }: TextareaProps) {
    return (
        <textarea
            {...rest}
            className={cn(
                "min-h-[120px] resize-y rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40",
                "focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40",
                className,
            )}
        />
    );
}

interface StatTileProps {
    label: string;
    value: string;
    hint?: string;
    accent?: "cyan" | "violet" | "neutral";
}

export function ToolStatTile({ label, value, hint, accent = "cyan" }: StatTileProps) {
    const accentCls = accent === "violet"
        ? "from-violet-500/15 via-violet-400/5 to-cyan-500/5 border-violet-400/30"
        : accent === "neutral"
            ? "from-white/5 via-white/0 to-white/5 border-white/10"
            : "from-cyan-500/15 via-cyan-400/5 to-violet-500/10 border-cyan-400/30";
    return (
        <div
            className={cn(
                "rounded-2xl border bg-gradient-to-br p-5",
                "print:rounded-lg print:border-slate-300 print:from-slate-50 print:via-white print:to-slate-50 print:bg-white",
                accentCls,
            )}
        >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 print:text-slate-700">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl print:text-slate-900">{value}</p>
            {hint ? <p className="mt-1 text-xs text-slate-300 print:text-slate-600">{hint}</p> : null}
        </div>
    );
}

interface CheckboxButtonProps {
    checked: boolean;
    onChange: () => void;
    children: ReactNode;
    /** Aria label override if children are non-text. */
    ariaLabel?: string;
}

export function ToolCheckboxButton({ checked, onChange, children, ariaLabel }: CheckboxButtonProps) {
    return (
        <button
            type="button"
            onClick={onChange}
            aria-pressed={checked}
            aria-label={ariaLabel}
            className={cn(
                "rounded-xl border px-3 py-2 text-left text-sm transition",
                checked
                    ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100 shadow-[0_0_16px_rgba(6,182,212,0.25)]"
                    : "border-white/15 bg-white/5 text-slate-200 hover:border-cyan-300/40 hover:bg-white/10",
            )}
        >
            {children}
        </button>
    );
}

interface SegmentedProps<T extends string> {
    value: T;
    options: ReadonlyArray<{ value: T; label: string }>;
    onChange: (value: T) => void;
}

export function ToolSegmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
    return (
        <div className="flex flex-wrap gap-1.5 rounded-full border border-white/10 bg-slate-900/60 p-1 backdrop-blur-md">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        "h-9 flex-1 rounded-full px-3 text-xs font-medium uppercase tracking-wider transition",
                        value === opt.value
                            ? "bg-cyan-500 text-slate-950 shadow-[0_0_18px_rgba(6,182,212,0.45)]"
                            : "text-slate-300 hover:bg-white/5 hover:text-white",
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

interface RangeProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
    onChange: (v: number) => void;
    helper?: string;
}

export function ToolRange({ label, value, min, max, step = 1, suffix, onChange, helper }: RangeProps) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-slate-300">{label}</span>
                <span className="text-sm font-semibold text-cyan-300">
                    {value}
                    {suffix ?? ""}
                </span>
            </div>
            {helper ? <span className="text-[11px] text-slate-400">{helper}</span> : null}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            />
        </div>
    );
}

interface ResultCalloutProps {
    eyebrow?: string;
    headline: string;
    body?: string;
    children?: ReactNode;
}

export function ToolResultCallout({ eyebrow, headline, body, children }: ResultCalloutProps) {
    return (
        <ToolPanel tone="highlight">
            {eyebrow ? (
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200 print:text-slate-700">{eyebrow}</p>
            ) : null}
            <h2 className="mt-2 text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl print:text-slate-900">
                {headline}
            </h2>
            {body ? <p className="mt-2 text-sm text-slate-300 print:text-slate-700">{body}</p> : null}
            {children ? <div className="mt-6">{children}</div> : null}
        </ToolPanel>
    );
}

/** Print-only summary block — visible in window.print() output. */
interface PrintSummaryProps {
    title: string;
    contactLine?: string | null;
    children: ReactNode;
}

export function ToolPrintSummary({ title, contactLine, children }: PrintSummaryProps) {
    return (
        <div className="hidden print:block">
            <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            {contactLine ? <p className="mt-1 text-sm text-slate-700">{contactLine}</p> : null}
            <div className="mt-4 text-sm text-slate-900">{children}</div>
            <p className="mt-6 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Powered by iSystem.ai · Free public tools
            </p>
        </div>
    );
}
