"use client";

import { useState } from "react";
import { DashboardAppWorkbench } from "@/features/admin/ui/app-workbench";

// Minimal calculator — four functions, percentage, sign toggle, clear.
// No persistence, no history beyond the current-operation pair. Mirrors
// the behaviour of a pocket calculator the user would reach for between
// dashboard tasks.
type Operator = "+" | "-" | "×" | "÷";

interface CalcState {
    display: string;
    previous: number | null;
    operator: Operator | null;
    shouldResetOnNextDigit: boolean;
}

const INITIAL: CalcState = {
    display: "0",
    previous: null,
    operator: null,
    shouldResetOnNextDigit: false,
};

function evaluate(prev: number, op: Operator, current: number): number {
    switch (op) {
        case "+": return prev + current;
        case "-": return prev - current;
        case "×": return prev * current;
        case "÷": return current === 0 ? 0 : prev / current;
    }
}

function formatDisplay(value: number): string {
    if (!Number.isFinite(value)) return "Error";
    // Strip trailing zeros and unnecessary decimal point; cap precision so
    // 1/3 doesn't overflow the display width.
    const rounded = Math.round(value * 1e10) / 1e10;
    return rounded.toString().slice(0, 16);
}

export function CalculatorApp() {
    const [state, setState] = useState<CalcState>(INITIAL);

    const pushDigit = (digit: string) => {
        setState((s) => {
            if (s.shouldResetOnNextDigit || s.display === "0") {
                return { ...s, display: digit, shouldResetOnNextDigit: false };
            }
            if (s.display.length >= 16) return s;
            return { ...s, display: s.display + digit };
        });
    };

    const pushDot = () => {
        setState((s) => {
            if (s.shouldResetOnNextDigit) {
                return { ...s, display: "0.", shouldResetOnNextDigit: false };
            }
            if (s.display.includes(".")) return s;
            return { ...s, display: s.display + "." };
        });
    };

    const pushOperator = (op: Operator) => {
        setState((s) => {
            const current = Number(s.display);
            if (s.previous !== null && s.operator && !s.shouldResetOnNextDigit) {
                const result = evaluate(s.previous, s.operator, current);
                return {
                    display: formatDisplay(result),
                    previous: result,
                    operator: op,
                    shouldResetOnNextDigit: true,
                };
            }
            return {
                display: s.display,
                previous: current,
                operator: op,
                shouldResetOnNextDigit: true,
            };
        });
    };

    const pushEquals = () => {
        setState((s) => {
            if (s.previous === null || !s.operator) return s;
            const current = Number(s.display);
            const result = evaluate(s.previous, s.operator, current);
            return {
                display: formatDisplay(result),
                previous: null,
                operator: null,
                shouldResetOnNextDigit: true,
            };
        });
    };

    const handleClear = () => setState(INITIAL);
    const handleToggleSign = () => setState((s) => ({ ...s, display: formatDisplay(Number(s.display) * -1) }));
    const handlePercent = () => setState((s) => ({ ...s, display: formatDisplay(Number(s.display) / 100) }));

    return (
        <DashboardAppWorkbench>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/10 p-8">
            <div className="w-full max-w-xs rounded-md border border-border/60 bg-background p-4 shadow-lg">
                <div
                    aria-live="polite"
                    className="mb-4 flex h-16 items-center justify-end overflow-hidden rounded-md border border-border/40 bg-slate-950 px-3 text-right font-mono text-[31px] text-slate-100"
                >
                    {state.display}
                </div>

                <div className="grid grid-cols-4 gap-2">
                    <Button variant="action" onClick={handleClear}>C</Button>
                    <Button variant="action" onClick={handleToggleSign}>±</Button>
                    <Button variant="action" onClick={handlePercent}>%</Button>
                    <Button variant="operator" onClick={() => pushOperator("÷")} active={state.operator === "÷"}>÷</Button>

                    <Button onClick={() => pushDigit("7")}>7</Button>
                    <Button onClick={() => pushDigit("8")}>8</Button>
                    <Button onClick={() => pushDigit("9")}>9</Button>
                    <Button variant="operator" onClick={() => pushOperator("×")} active={state.operator === "×"}>×</Button>

                    <Button onClick={() => pushDigit("4")}>4</Button>
                    <Button onClick={() => pushDigit("5")}>5</Button>
                    <Button onClick={() => pushDigit("6")}>6</Button>
                    <Button variant="operator" onClick={() => pushOperator("-")} active={state.operator === "-"}>−</Button>

                    <Button onClick={() => pushDigit("1")}>1</Button>
                    <Button onClick={() => pushDigit("2")}>2</Button>
                    <Button onClick={() => pushDigit("3")}>3</Button>
                    <Button variant="operator" onClick={() => pushOperator("+")} active={state.operator === "+"}>+</Button>

                    <Button className="col-span-2" onClick={() => pushDigit("0")}>0</Button>
                    <Button onClick={pushDot}>.</Button>
                    <Button variant="equals" onClick={pushEquals}>=</Button>
                </div>
            </div>
        </div>
        </DashboardAppWorkbench>
    );
}

type ButtonVariant = "digit" | "operator" | "action" | "equals";

function Button({
    children,
    onClick,
    variant = "digit",
    active = false,
    className = "",
}: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: ButtonVariant;
    active?: boolean;
    className?: string;
}) {
    const base = "h-12 rounded-md text-[19px] font-semibold transition-colors";
    const variantClass =
        variant === "operator"
            ? active
                ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                : "bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-300"
            : variant === "action"
                ? "bg-muted text-muted-foreground hover:bg-muted/70"
                : variant === "equals"
                    ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                    : "bg-background border border-border/60 text-foreground hover:bg-muted/40";
    return (
        <button type="button" onClick={onClick} className={`${base} ${variantClass} ${className}`}>
            {children}
        </button>
    );
}
