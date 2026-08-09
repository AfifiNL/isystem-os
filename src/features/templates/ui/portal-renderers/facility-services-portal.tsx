"use client";

import { useRef, useState, useCallback } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import {
    Building2,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Shield,
    MapPin,
    Activity,
    Download,
    Filter,
    ArrowLeft,
} from "lucide-react";
import {
    prefersReducedMotion,
    scrubMaskReveal,
    scrubCards,
} from "@/features/templates/ui/theme-renderers/gsap-utils";
import type {
    FacilityDataResult,
    FacilityLocation,
    CleaningSchedule,
} from "@/features/portal/actions/facility-operations-actions";
import { PortalTaskFlagButton } from "@/features/portal/ui/portal-task-flag-button";

gsap.registerPlugin(ScrollTrigger);

/* ────────────────────────────────────────────────────────────── */
/*  Types & Constants — Facility Services Design System                  */
/* ────────────────────────────────────────────────────────────── */

type StatusFilter = "all" | "compliant" | "pending" | "issue";

// Facility Services brand palette
const NAVY = "#002f58";
const BLUE = "#0d4f8c";
const ACCENT = "#4A90E2";

const STATUS_CONFIG: Record<
    string,
    {
        label: string;
        textColor: string;
        bgColor: string;
        borderColor: string;
        activeText: string;
        activeBg: string;
        activeBorder: string;
        icon: typeof CheckCircle2;
    }
> = {
    compliant: {
        label: "Compliant",
        textColor: "text-emerald-700",
        bgColor: "bg-emerald-50",
        borderColor: "border-emerald-200",
        activeText: "text-emerald-800",
        activeBg: "bg-emerald-100",
        activeBorder: "border-emerald-400",
        icon: CheckCircle2,
    },
    pending: {
        label: "Pending",
        textColor: "text-amber-700",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-200",
        activeText: "text-amber-800",
        activeBg: "bg-amber-100",
        activeBorder: "border-amber-400",
        icon: Clock,
    },
    issue: {
        label: "Issue",
        textColor: "text-red-700",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        activeText: "text-red-800",
        activeBg: "bg-red-100",
        activeBorder: "border-red-400",
        icon: AlertTriangle,
    },
};

/* ────────────────────────────────────────────────────────────── */
/*  Helpers                                                      */
/* ────────────────────────────────────────────────────────────── */

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
}

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function exportToCsv(
    locations: FacilityLocation[],
    statusFilter: StatusFilter,
    locationFilter: string
) {
    const header = ["Location", "Task", "Frequency", "Last Completed", "Status"];
    const rows: string[][] = [];

    for (const loc of locations) {
        if (locationFilter !== "all" && loc.id !== locationFilter) continue;
        for (const s of loc.cleaning_schedules) {
            if (statusFilter !== "all" && s.status !== statusFilter) continue;
            rows.push([
                `"${loc.name.replace(/"/g, '""')}"`,
                `"${s.task_name.replace(/"/g, '""')}"`,
                `"${s.frequency ?? ""}"`,
                `"${formatDate(s.last_completed_at)}"`,
                `"${s.status}"`,
            ]);
        }
    }

    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sla-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ────────────────────────────────────────────────────────────── */
/*  Sub-components                                               */
/* ────────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${cfg.bgColor} ${cfg.borderColor} ${cfg.textColor}`}
        >
            <Icon className="h-3 w-3" />
            {cfg.label}
        </span>
    );
}

function SlaGauge({ percentage }: { percentage: number }) {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const color = percentage >= 95 ? "#059669" : percentage >= 80 ? "#d97706" : "#dc2626";

    return (
        <div className="relative mx-auto h-36 w-36">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle
                    cx="60" cy="60" r={radius} fill="none"
                    stroke={color} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    className="transition-[stroke-dashoffset] duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold tracking-tight" style={{ color: NAVY }}>{percentage}%</span>
                <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">SLA Score</span>
            </div>
        </div>
    );
}

function ScheduleTable({ schedules }: { schedules: CleaningSchedule[] }) {
    if (schedules.length === 0) {
        return (
            <p className="py-4 text-center text-sm text-slate-400">No matching tasks</p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200 text-start text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        <th className="pb-3 pe-4">Task</th>
                        <th className="pb-3 pe-4">Frequency</th>
                        <th className="pb-3 pe-4">Last Completed</th>
                        <th className="pb-3 pe-4">Status</th>
                        <th className="pb-3">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {schedules.map((s) => (
                        <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                            <td className="py-3 pe-4 font-semibold text-slate-800">{s.task_name}</td>
                            <td className="py-3 pe-4 text-slate-500">{s.frequency ?? "—"}</td>
                            <td className="py-3 pe-4 text-slate-500">{formatDate(s.last_completed_at)}</td>
                            <td className="py-3 pe-4"><StatusBadge status={s.status} /></td>
                            <td className="py-3">
                                <PortalTaskFlagButton scheduleId={s.id} taskName={s.task_name} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

interface LocationCardProps {
    location: FacilityLocation;
    statusFilter: StatusFilter;
}

function LocationCard({ location, statusFilter }: LocationCardProps) {
    const filteredSchedules = statusFilter === "all"
        ? location.cleaning_schedules
        : location.cleaning_schedules.filter((s) => s.status === statusFilter);

    const compliant = location.cleaning_schedules.filter((s) => s.status === "compliant").length;
    const total = location.cleaning_schedules.length;
    const pct = total > 0 ? Math.round((compliant / total) * 100) : 100;
    const pctColor = pct >= 90 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600";

    return (
        <div data-bento-item className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            {/* Card header — Facility Services navy bar */}
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center" style={{ background: NAVY }}>
                        <Building2 className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">{location.name}</h3>
                        {location.address && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                                <MapPin className="h-3 w-3" />
                                {location.address}
                            </p>
                        )}
                    </div>
                </div>
                <div className="text-end">
                    <p className={`text-xl font-extrabold tabular-nums ${pctColor}`}>{pct}%</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        {compliant}/{total} tasks
                    </p>
                </div>
            </div>

            {/* Schedule table */}
            <div className="px-6 py-4">
                <ScheduleTable schedules={filteredSchedules} />
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────── */
/*  Filter Bar                                                   */
/* ────────────────────────────────────────────────────────────── */

interface FilterBarProps {
    locations: FacilityLocation[];
    statusFilter: StatusFilter;
    locationFilter: string;
    onStatusChange: (s: StatusFilter) => void;
    onLocationChange: (id: string) => void;
    onExport: () => void;
}

function FilterBar({
    locations,
    statusFilter,
    locationFilter,
    onStatusChange,
    onLocationChange,
    onExport,
}: FilterBarProps) {
    const statuses: StatusFilter[] = ["all", "compliant", "pending", "issue"];

    return (
        <div className="mb-8 flex flex-wrap items-center gap-3 border border-slate-200 bg-slate-50 px-5 py-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                <Filter className="h-3 w-3" />
                Filter
            </div>

            {/* Status pills */}
            <div className="flex flex-wrap gap-2">
                {statuses.map((s) => {
                    const isActive = statusFilter === s;
                    if (s === "all") {
                        return (
                            <button
                                key="all"
                                onClick={() => onStatusChange("all")}
                                className={`rounded-none border px-3 py-1 text-xs font-semibold transition-all ${isActive
                                        ? "border-slate-800 bg-slate-800 text-white"
                                        : "border-slate-300 text-slate-500 hover:border-slate-500 hover:text-slate-700"
                                    }`}
                            >
                                All
                            </button>
                        );
                    }
                    const cfg = STATUS_CONFIG[s];
                    const Icon = cfg.icon;
                    return (
                        <button
                            key={s}
                            onClick={() => onStatusChange(s)}
                            className={`inline-flex items-center gap-1.5 rounded-none border px-3 py-1 text-xs font-semibold transition-all ${isActive
                                    ? `${cfg.activeBg} ${cfg.activeBorder} ${cfg.activeText}`
                                    : `border-slate-200 text-slate-500 hover:${cfg.bgColor} hover:${cfg.borderColor} hover:${cfg.textColor}`
                                }`}
                        >
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                        </button>
                    );
                })}
            </div>

            {/* Location dropdown */}
            {locations.length > 1 && (
                <select
                    value={locationFilter}
                    onChange={(e) => onLocationChange(e.target.value)}
                    className="h-7 border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    style={{ focusRingColor: ACCENT } as React.CSSProperties}
                >
                    <option value="all">All Locations</option>
                    {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                </select>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Export CSV */}
            <button
                onClick={onExport}
                className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:border-[#002f58] hover:bg-[#002f58] hover:text-white"
            >
                <Download className="h-3.5 w-3.5" />
                Export CSV
            </button>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────── */
/*  Stat Card                                                    */
/* ────────────────────────────────────────────────────────────── */

function StatCard({
    icon: Icon,
    value,
    label,
    accentColor = NAVY,
}: {
    icon: typeof Building2;
    value: number | string;
    label: string;
    accentColor?: string;
}) {
    return (
        <div data-bento-item className="flex items-center gap-5 border border-slate-200 bg-white p-8 shadow-sm">
            <div
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center"
                style={{ background: accentColor }}
            >
                <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
                <p className="text-3xl font-extrabold tabular-nums tracking-tight" style={{ color: NAVY }}>{value}</p>
                <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">{label}</p>
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────── */
/*  Main Dashboard Component                                     */
/* ────────────────────────────────────────────────────────────── */

interface FacilityServicesPortalProps {
    data: FacilityDataResult;
}

export default function FacilityServicesPortal({ data }: FacilityServicesPortalProps) {
    const headerRef = useRef<HTMLElement>(null);
    const gridRef = useRef<HTMLElement>(null);

    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [locationFilter, setLocationFilter] = useState<string>("all");

    const visibleLocations = data.locations.filter((loc) => {
        if (locationFilter !== "all" && loc.id !== locationFilter) return false;
        if (statusFilter === "all") return true;
        return loc.cleaning_schedules.some((s) => s.status === statusFilter);
    });

    const handleExport = useCallback(() => {
        exportToCsv(data.locations, statusFilter, locationFilter);
    }, [data.locations, statusFilter, locationFilter]);

    /* ── GSAP: Header reveal ─────────────────────────── */
    useGSAP(
        () => {
            if (!headerRef.current) return;
            if (prefersReducedMotion()) {
                gsap.set("[data-portal-title]", { clipPath: "inset(0 0% 0 0)" });
                gsap.set("[data-portal-fade]", { opacity: 1, y: 0 });
                return;
            }

            scrubMaskReveal(headerRef.current, "[data-portal-title]", {
                direction: "left",
                startOffset: "top 98%",
                endOffset: "top 50%",
            });

            gsap.fromTo(
                "[data-portal-fade]",
                { y: 30, opacity: 0 },
                {
                    y: 0, opacity: 1, stagger: 0.15, ease: "power2.out",
                    scrollTrigger: {
                        trigger: headerRef.current,
                        start: "top 90%", end: "top 40%", scrub: 2.2,
                    },
                }
            );
        },
        { scope: headerRef }
    );

    /* ── GSAP: Bento grid reveal ───────────── */
    useGSAP(
        () => {
            if (!gridRef.current) return;
            if (prefersReducedMotion()) {
                gsap.set("[data-bento-item]", { opacity: 1, y: 0 });
                return;
            }
            scrubCards(gridRef.current, "[data-bento-item]", {
                y: 60, startOffset: "top 85%", endOffset: "top 25%", stagger: 0.08,
            });
        },
        { scope: gridRef }
    );

    return (
        <div className="min-h-screen bg-white [font-family:var(--font-inter)] text-slate-900">
            {/* ── HEADER ──────────────────────────────────────────── */}
            <section
                ref={headerRef}
                className="relative overflow-hidden border-b border-slate-800"
                style={{ background: NAVY }}
            >
                {/* Subtle grid texture */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

                <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 lg:px-12 lg:py-20">
                    {/* Logo */}
                    <div data-portal-fade className="mb-8">
                        <Image
                            src="/themes/facility-services/logo.svg"
                            alt="Facility Services Demo"
                            width={150}
                            height={50}
                            className="h-auto w-auto"
                            priority
                        />
                    </div>

                    <p
                        data-portal-fade
                        className="mb-2 text-xs font-bold uppercase tracking-[0.25em]"
                        style={{ color: `${ACCENT}cc` }}
                    >
                        Partner Command Center
                    </p>
                    <h1
                        data-portal-title
                        className="mb-4 text-4xl font-extrabold leading-[1.08] tracking-[-0.02em] text-white lg:text-5xl"
                        style={{ clipPath: "inset(0 100% 0 0)" }}
                    >
                        {getGreeting()}{data.companyName ? `, ${data.companyName}` : ""}
                    </h1>
                    <p data-portal-fade className="max-w-xl text-base leading-relaxed text-white/65">
                        Your facility operations &amp; SLA compliance at a glance.
                    </p>
                </div>
            </section>

            {/* ── CONTENT ─────────────────────────────────────────── */}
            <section
                ref={gridRef}
                className="mx-auto max-w-7xl px-6 py-12 lg:px-12 lg:py-16"
            >
                {/* Stats bar */}
                <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* SLA Gauge card */}
                    <div
                        data-bento-item
                        className="flex flex-col items-center justify-center border border-slate-200 bg-white p-8 shadow-sm sm:col-span-2 lg:col-span-1"
                    >
                        <SlaGauge percentage={data.slaPercentage} />
                    </div>

                    <StatCard icon={Building2} value={data.locations.length} label="Active Locations" accentColor={NAVY} />
                    <StatCard icon={Activity} value={data.totalTasks} label="Tracked Tasks" accentColor={BLUE} />
                    <StatCard icon={Shield} value={data.compliantTasks} label="Compliant" accentColor="#059669" />
                </div>

                {/* Locations header */}
                <div className="mb-4 flex items-center gap-3">
                    <div
                        className="flex h-6 w-1.5 flex-shrink-0"
                        style={{ background: ACCENT }}
                    />
                    <h2 className="text-xl font-bold tracking-[-0.01em] text-slate-900">Facility Locations</h2>
                    <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">
                        {visibleLocations.length}
                        {visibleLocations.length !== data.locations.length && ` / ${data.locations.length}`}
                    </span>
                </div>

                <FilterBar
                    locations={data.locations}
                    statusFilter={statusFilter}
                    locationFilter={locationFilter}
                    onStatusChange={setStatusFilter}
                    onLocationChange={setLocationFilter}
                    onExport={handleExport}
                />

                {data.locations.length === 0 ? (
                    <div data-bento-item className="flex flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-8 py-20">
                        <Building2 className="mb-4 h-12 w-12 text-slate-300" />
                        <p className="text-sm text-slate-400">No locations assigned to your account yet.</p>
                        <p className="mt-1 text-xs text-slate-400">Contact your facility manager to get started.</p>
                    </div>
                ) : visibleLocations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-8 py-16">
                        <Filter className="mb-3 h-8 w-8 text-slate-300" />
                        <p className="text-sm text-slate-400">No tasks match your current filters.</p>
                        <button
                            onClick={() => { setStatusFilter("all"); setLocationFilter("all"); }}
                            className="mt-3 border-b border-transparent text-xs font-semibold transition-colors hover:border-current"
                            style={{ color: ACCENT }}
                        >
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                        {visibleLocations.map((loc) => (
                            <LocationCard key={loc.id} location={loc} statusFilter={statusFilter} />
                        ))}
                    </div>
                )}
            </section>

            {/* ── FOOTER BAR ──────────────────────────────────────── */}
            <footer className="border-t border-slate-200 bg-slate-50 px-6 py-8">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
                    <Image
                        src="/themes/facility-services/logo.svg"
                        alt="Facility Services Demo"
                        width={120}
                        height={32}
                        className="h-7 w-auto opacity-60"
                    />
                    <p className="text-xs text-slate-400">
                        Partner Portal — Data refreshed on page load
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-700"
                    >
                        <ArrowLeft className="h-3 w-3" />
                        Back to website
                    </Link>
                </div>
            </footer>
        </div>
    );
}
