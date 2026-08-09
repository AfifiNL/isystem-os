import React, { useId } from "react";
import { cn } from "@/shared/lib/utils";

interface AppTrendPoint {
    label: string;
    value: number;
}

interface AppTrendChartProps {
    data: AppTrendPoint[];
    title: string;
    description?: string;
    valueLabel?: string;
    className?: string;
}

function pathFor(points: Array<{ x: number; y: number }>) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function AppTrendChart({
    data,
    title,
    description,
    valueLabel = "value",
    className,
}: AppTrendChartProps) {
    const gradientId = useId().replace(/:/g, "");
    const width = 720;
    const height = 188;
    const padX = 20;
    const padY = 18;
    const values = data.map((point) => Number.isFinite(point.value) ? point.value : 0);
    const max = Math.max(1, ...values);
    const min = Math.min(0, ...values);
    const span = Math.max(1, max - min);
    const points = data.map((point, index) => ({
        x: padX + (data.length <= 1 ? 0 : (index / (data.length - 1)) * (width - padX * 2)),
        y: padY + ((max - point.value) / span) * (height - padY * 2),
    }));
    const linePath = pathFor(points);
    const areaPath = points.length > 0
        ? `${linePath} L ${points.at(-1)?.x ?? padX} ${height - padY} L ${points[0]?.x ?? padX} ${height - padY} Z`
        : "";
    const first = values[0] ?? 0;
    const last = values.at(-1) ?? 0;
    const delta = last - first;

    return (
        <figure className={cn("app-visual-panel overflow-hidden border-y border-border/55 bg-transparent", className)}>
            <figcaption className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 px-3 py-2">
                <div>
                    <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
                    {description ? <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p> : null}
                </div>
                <span className={cn(
                    "rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                    delta > 0 && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    delta < 0 && "bg-rose-500/10 text-rose-700 dark:text-rose-300",
                    delta === 0 && "bg-muted text-muted-foreground",
                )}>
                    {delta > 0 ? "+" : ""}{delta} {valueLabel}
                </span>
            </figcaption>
            {points.length > 0 ? (
                <div className="px-2 pb-2 pt-1">
                    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label={`${title}: ${data.map((point) => `${point.label} ${point.value}`).join(", ")}`}>
                        <defs>
                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.24" />
                                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {[0.25, 0.5, 0.75].map((ratio) => (
                            <line key={ratio} x1={padX} x2={width - padX} y1={height * ratio} y2={height * ratio} stroke="var(--border)" strokeOpacity="0.55" strokeDasharray="3 6" />
                        ))}
                        <path d={areaPath} fill={`url(#${gradientId})`} />
                        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        {points.map((point, index) => (
                            <g key={`${data[index]?.label}-${index}`}>
                                <circle cx={point.x} cy={point.y} r="3.5" fill="var(--background)" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                <title>{data[index]?.label}: {data[index]?.value}</title>
                            </g>
                        ))}
                    </svg>
                    <div className="flex justify-between px-2 text-[10px] text-muted-foreground">
                        <span>{data[0]?.label}</span>
                        <span>{data.at(-1)?.label}</span>
                    </div>
                </div>
            ) : (
                <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">No trend data yet.</p>
            )}
        </figure>
    );
}
