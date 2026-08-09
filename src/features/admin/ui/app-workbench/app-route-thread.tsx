"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";

export interface DashboardRouteThread {
    title: string;
    stages: string[];
    feedback: string;
}

const ROUTE_THREADS: Record<string, DashboardRouteThread> = {
    analytics: { title: "Audience-to-outcome", stages: ["Attention", "Intent", "Outcome", "Audience"], feedback: "next content decision" },
    automations: { title: "Event-to-action", stages: ["Trigger", "Route", "Approve", "Execute", "Learn"], feedback: "exception changes the rule" },
    booking: { title: "Demand-to-retention", stages: ["Demand", "Slot", "Confirm", "Settle", "Retain"], feedback: "no-show changes capacity" },
    builder: { title: "Intent-to-interface", stages: ["Intent", "Compose", "Review", "Publish"], feedback: "evidence changes the next block" },
    calculator: { title: "Question-to-decision", stages: ["Input", "Compute", "Check", "Use"], feedback: "assumption changes the model" },
    "case-snippets": { title: "Proof-to-reuse", stages: ["Capture", "Curate", "Reuse", "Improve"], feedback: "outcome changes the library" },
    clients: { title: "Client-to-renewal", stages: ["Onboard", "Deliver", "Review", "Renew"], feedback: "SLA signal changes the plan" },
    "commercial-ops": { title: "Pipeline-to-cash", stages: ["Pipeline", "Obligation", "Invoice", "Collect"], feedback: "leak changes the handoff" },
    content: { title: "Brief-to-learning", stages: ["Brief", "Draft", "Review", "Publish", "Learn"], feedback: "performance changes the brief" },
    "creative-studio": { title: "Brief-to-asset", stages: ["Brief", "Generate", "Review", "Render", "Reuse"], feedback: "audit changes the next version" },
    customers: { title: "Signal-to-resolution", stages: ["Signal", "Qualify", "Assign", "Resolve"], feedback: "resolution changes ownership" },
    "external-publishing": { title: "Opportunity-to-authority", stages: ["Opportunity", "Package", "Approve", "Publish", "Learn"], feedback: "response changes the package" },
    generate: { title: "Prompt-to-draft", stages: ["Brief", "Generate", "Review", "Publish"], feedback: "review changes the prompt" },
    health: { title: "Signal-to-recovery", stages: ["Signal", "Diagnose", "Prioritize", "Recover"], feedback: "failure changes the threshold" },
    inbox: { title: "Alert-to-resolution", stages: ["Detect", "Triage", "Assign", "Resolve"], feedback: "resolution changes the rule" },
    integrations: { title: "System-to-system", stages: ["Connect", "Sync", "Verify", "Recover"], feedback: "drift changes the owner" },
    "legal-vault": { title: "Record-to-trust", stages: ["Capture", "Sign", "Store", "Reconcile"], feedback: "exception changes retention" },
    "legibility-hub": { title: "Question-to-evidence", stages: ["Ask", "Retrieve", "Verify", "Apply"], feedback: "missing evidence changes search" },
    "manual-posts": { title: "Draft-to-library", stages: ["Draft", "Review", "Publish", "Learn"], feedback: "engagement changes the queue" },
    "market-monitor": { title: "Signal-to-position", stages: ["Observe", "Compare", "Assess", "Act", "Recheck"], feedback: "new evidence changes the position" },
    newsletter: { title: "Audience-to-retention", stages: ["Audience", "Compose", "Approve", "Dispatch", "Measure"], feedback: "response changes the next send" },
    notes: { title: "Thought-to-action", stages: ["Capture", "Organize", "Recall", "Act"], feedback: "new context changes priority" },
    opportunities: { title: "Gap-to-leverage", stages: ["Detect", "Score", "Commit", "Execute", "Learn"], feedback: "conversion changes the score" },
    outreach: { title: "Prospect-to-conversation", stages: ["Discover", "Enrich", "Approve", "Send", "Learn"], feedback: "reply changes the segment" },
    podcast: { title: "Story-to-signal", stages: ["Brief", "Produce", "Review", "Publish", "Reuse"], feedback: "retention changes the story" },
    popups: { title: "Intent-to-conversion", stages: ["Trigger", "Engage", "Convert", "Measure", "Tune"], feedback: "dismissal changes the trigger" },
    recorder: { title: "Voice-to-memory", stages: ["Capture", "Transcribe", "Review", "Reuse"], feedback: "clarity changes the note" },
    "render-queue": { title: "Queue-to-delivery", stages: ["Queue", "Render", "Verify", "Deliver", "Retry"], feedback: "failure changes the queue" },
    seo: { title: "Evidence-to-growth", stages: ["Observe", "Diagnose", "Execute", "Measure", "Learn"], feedback: "ranking changes the next action" },
    settings: { title: "Configuration-to-governance", stages: ["Configure", "Govern", "Verify", "Rollback"], feedback: "drift changes the policy" },
    slas: { title: "Promise-to-proof", stages: ["Promise", "Track", "Escalate", "Close", "Learn"], feedback: "breach changes capacity" },
    "source-intelligence": { title: "Source-to-confidence", stages: ["Register", "Retrieve", "Verify", "Cite", "Refresh"], feedback: "stale evidence changes trust" },
    videos: { title: "Capture-to-distribution", stages: ["Capture", "Process", "Review", "Publish", "Learn"], feedback: "watch behavior changes the cut" },
    voices: { title: "Voice-to-performance", stages: ["Select", "Generate", "Review", "Reuse"], feedback: "listener signal changes the preset" },
    "music-library": { title: "Sound-to-recognition", stages: ["Select", "Arrange", "Review", "Reuse"], feedback: "usage changes the library" },
    work: { title: "Work-to-learning", stages: ["Detect", "Prioritize", "Assign", "Deliver", "Learn"], feedback: "blocker changes the plan" },
    workspaces: { title: "Workspace-to-scale", stages: ["Configure", "Theme", "Govern", "Scale"], feedback: "usage changes the default" },
};

// A route family gives each working surface a visual accent without turning
// every app into a bespoke theme. The accent is a wayfinding signal: evidence
// work reads cool, production work reads vivid, and operational work reads
// warm/green. It is intentionally data-driven so nested routes inherit the
// same visual grammar as their parent app.
const ROUTE_FAMILIES: Record<string, "evidence" | "content" | "operations" | "relationships" | "governance"> = {
    analytics: "evidence",
    calculator: "evidence",
    health: "evidence",
    "legibility-hub": "evidence",
    "market-monitor": "evidence",
    seo: "evidence",
    "source-intelligence": "evidence",
    builder: "content",
    content: "content",
    "creative-studio": "content",
    generate: "content",
    "manual-posts": "content",
    "music-library": "content",
    newsletter: "content",
    podcast: "content",
    recorder: "content",
    "render-queue": "content",
    videos: "content",
    voices: "content",
    automations: "operations",
    booking: "operations",
    "commercial-ops": "operations",
    "external-publishing": "operations",
    inbox: "operations",
    opportunities: "operations",
    outreach: "operations",
    popups: "operations",
    work: "operations",
    clients: "relationships",
    customers: "relationships",
    slas: "relationships",
    integrations: "governance",
    "case-snippets": "governance",
    "legal-vault": "governance",
    notes: "governance",
    settings: "governance",
    workspaces: "governance",
};

export function resolveDashboardRouteThread(pathname: string): DashboardRouteThread | null {
    if (!pathname.startsWith("/dashboard/") || pathname === "/dashboard/") return null;
    const key = pathname.slice("/dashboard/".length).split("/")[0] ?? "";
    return ROUTE_THREADS[key] ?? null;
}

export function resolveDashboardRouteFamily(pathname: string): string {
    const key = pathname.startsWith("/dashboard/")
        ? pathname.slice("/dashboard/".length).split("/")[0] ?? ""
        : pathname;
    return ROUTE_FAMILIES[key] ?? "governance";
}

export function listDashboardRouteThreadKeys() {
    return Object.keys(ROUTE_THREADS);
}

export function DashboardRouteThread({ className, routeKey }: { className?: string; routeKey?: string }) {
    const pathname = usePathname();
    const thread = resolveDashboardRouteThread(routeKey ? `/dashboard/${routeKey}` : pathname);
    if (!thread) return null;
    const resolvedPath = routeKey ? `/dashboard/${routeKey}` : pathname;

    return (
        <div
            data-dashboard-route-thread={thread.title}
            data-dashboard-route-family={resolveDashboardRouteFamily(resolvedPath)}
            className={cn("dashboard-route-thread flex min-w-0 items-center gap-2 border-b border-border/45 bg-background/80 px-2.5 py-1 text-[10px] text-muted-foreground backdrop-blur-xl sm:px-3", className)}
            aria-label={`${thread.title} operating thread`}
        >
            <span className="shrink-0 font-semibold uppercase tracking-[0.16em] text-primary/75">Thread</span>
            <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none]" aria-label={thread.title}>
                {thread.stages.map((stage, index) => (
                    <li key={stage} className="flex shrink-0 items-center gap-1">
                        <span className={cn("border-b border-transparent px-1 py-0.5", index === 0 && "border-primary/70 text-foreground")}>{stage}</span>
                        {index < thread.stages.length - 1 ? <span className="text-border" aria-hidden>→</span> : null}
                    </li>
                ))}
            </ol>
            <span className="hidden max-w-[18rem] shrink-0 truncate border-l border-border/45 pl-2 text-[10px] sm:inline" title={thread.feedback}>↺ {thread.feedback}</span>
        </div>
    );
}
