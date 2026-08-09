// Window metadata config for every dashboard sub-route ("app").
//
// The OS shell reads this map to render the correct chrome (title + icon +
// close behavior) around each page. Using a config map — rather than a
// per-page `windowMeta` export — keeps server components server-rendered:
// the shell layout is a client component (it needs usePathname), but the
// pages themselves stay on whatever runtime they prefer.
//
// Keys are the first path segment after /dashboard/. The desktop view
// (/dashboard itself) has no entry — that path is treated specially by the
// shell layout.

import type { LucideIcon } from "lucide-react";
import {
    AudioLines,
    BarChart3,
    BookOpen,
    Briefcase,
    Building,
    CalendarRange,
    Calculator,
    ClipboardCheck,
    CreditCard,
    DatabaseZap,
    FileText,
    Headphones,
    Inbox,
    LayoutTemplate,
    Mail,
    Megaphone,
    Mic,
    Music,
    Palette,
    PenSquare,
    Search,
    SearchCheck,
    Send,
    Server,
    Settings,
    Shield,
    Sparkles,
    Target,
    TrendingUp,
    Video,
} from "lucide-react";

export type WindowCategory = "workspace" | "productivity";

export interface WindowMeta {
    /** Title rendered in the window chrome. Keep short — sub-route-level. */
    title: string;
    /** App icon rendered next to the title and in the desktop grid. */
    icon: LucideIcon;
    /**
     * Where the close button navigates. Almost always "/dashboard" (the
     * desktop view) but left per-route in case a sub-app wants back to a
     * parent window in a later phase.
     */
    closeHref: string;
    /**
     * Short description shown under the icon on the desktop grid. Kept
     * tight — 60 chars or less — to fit the icon cell.
     */
    description: string;
    /**
     * Workspace apps are filtered against state.modules (role / tier /
     * capability gated). Productivity apps are always available to any
     * signed-in user and live under the Start menu rather than the desktop
     * icon grid by default.
     */
    category: WindowCategory;
}

export const WINDOW_META: Record<string, WindowMeta> = {
    analytics: {
        title: "Analytics",
        icon: BarChart3,
        closeHref: "/dashboard",
        description: "Workspace page views, conversions, and CTA analytics.",
        category: "workspace",
    },
    booking: {
        title: "Booking",
        icon: CalendarRange,
        closeHref: "/dashboard",
        description: "Appointment booking control center.",
        category: "workspace",
    },
    builder: {
        title: "Page Builder",
        icon: LayoutTemplate,
        closeHref: "/dashboard",
        description: "Compose public pages with design-system blocks.",
        category: "workspace",
    },
    clients: {
        title: "Client Management",
        icon: Briefcase,
        closeHref: "/dashboard",
        description: "Manage client profiles and SLAs.",
        category: "workspace",
    },
    "commercial-ops": {
        title: "Commercial Ops",
        icon: CreditCard,
        closeHref: "/dashboard",
        description: "Aggregate metrics from active workspace commercial links and legal invoices.",
        category: "workspace",
    },
    customers: {
        title: "Customers",
        icon: Briefcase,
        closeHref: "/dashboard",
        description: "Customer records, status, and follow-up ownership.",
        category: "workspace",
    },
    work: {
        title: "Work Queue",
        icon: ClipboardCheck,
        closeHref: "/dashboard",
        description: "Active work, blockers, SLA pressure, and next actions.",
        category: "workspace",
    },
    "legal-vault": {
        title: "Legal Vault",
        icon: Shield,
        closeHref: "/dashboard",
        description: "Agreements, invoices, and bewaarplicht-compliant bookkeeping.",
        category: "workspace",
    },
    content: {
        title: "Content Library",
        icon: FileText,
        closeHref: "/dashboard",
        description: "AI and manual drafts in one library.",
        category: "workspace",
    },
    generate: {
        title: "AI Draft Generator",
        icon: Sparkles,
        closeHref: "/dashboard",
        description: "Generate long-form drafts with guided prompts.",
        category: "workspace",
    },
    "creative-studio": {
        title: "Creative Studio",
        icon: Palette,
        closeHref: "/dashboard",
        description: "Briefs, prompts, render governance, assets, and audits.",
        category: "workspace",
    },
    "manual-posts": {
        title: "Manual Blog Library",
        icon: BookOpen,
        closeHref: "/dashboard",
        description: "Filtered view of manually authored posts.",
        category: "workspace",
    },
    "market-monitor": {
        title: "Market Monitor",
        icon: TrendingUp,
        closeHref: "/dashboard",
        description: "Competitor and authority-source signals.",
        category: "workspace",
    },
    newsletter: {
        title: "Newsletter",
        icon: Mail,
        closeHref: "/dashboard",
        description: "Audiences, campaigns, templates, automations, and dispatch.",
        category: "workspace",
    },
    automations: {
        title: "Automations",
        icon: Sparkles,
        closeHref: "/dashboard",
        description: "Automation lanes, triggers, handoffs, and exceptions.",
        category: "workspace",
    },
    inbox: {
        title: "Inbox",
        icon: Inbox,
        closeHref: "/dashboard",
        description: "Centralized workspace notifications and review items.",
        category: "workspace",
    },
    opportunities: {
        title: "Opportunity Engine",
        icon: Target,
        closeHref: "/dashboard",
        description: "Surface SEO, content, and conversion gaps.",
        category: "workspace",
    },
    "render-queue": {
        title: "Render Queue",
        icon: Server,
        closeHref: "/dashboard",
        description: "Manual video render job fulfillment.",
        category: "workspace",
    },
    seo: {
        title: "SEO Control Center",
        icon: SearchCheck,
        closeHref: "/dashboard",
        description: "Internal-link growth, strategist opportunities, plans.",
        category: "workspace",
    },
    "legibility-hub": {
        title: "Legibility Hub",
        icon: Search,
        closeHref: "/dashboard",
        description: "Semantic search engine across all workspace documents, notes, and tasks.",
        category: "workspace",
    },
    settings: {
        title: "Workspace Settings",
        icon: Settings,
        closeHref: "/dashboard",
        description: "General, theme, managers, AI credits, market monitor.",
        category: "workspace",
    },
    integrations: {
        title: "Integrations",
        icon: DatabaseZap,
        closeHref: "/dashboard",
        description: "Connected systems, owners, sync direction, and status.",
        category: "workspace",
    },
    health: {
        title: "Workspace Health",
        icon: Shield,
        closeHref: "/dashboard",
        description: "Operating signals, risk posture, and health checks.",
        category: "workspace",
    },
    slas: {
        title: "Project SLA Operations",
        icon: ClipboardCheck,
        closeHref: "/dashboard",
        description: "Client project deliverables, commitments, and SLA task tracking.",
        category: "workspace",
    },
    "source-intelligence": {
        title: "Source Intelligence",
        icon: DatabaseZap,
        closeHref: "/dashboard",
        description: "Governed source registry and evidence library.",
        category: "workspace",
    },
    outreach: {
        title: "Outreach",
        icon: Megaphone,
        closeHref: "/dashboard",
        description: "Governed prospect research and dispatch.",
        category: "workspace",
    },
    "external-publishing": {
        title: "External Publishing Studio",
        icon: Send,
        closeHref: "/dashboard",
        description: "Manual external publishing packages, evidence, and copy.",
        category: "workspace",
    },
    "admin-workspaces": {
        title: "Workspaces",
        icon: Building,
        closeHref: "/dashboard",
        description: "Admin: manage workspaces, themes, managers.",
        category: "workspace",
    },
    workspaces: {
        title: "Workspaces",
        icon: Building,
        closeHref: "/dashboard",
        description: "Admin: manage workspaces, themes, managers.",
        category: "workspace",
    },
    "music-library": {
        title: "Music Library",
        icon: Music,
        closeHref: "/dashboard",
        description: "Reusable intros, beds, and outros for podcasts.",
        category: "workspace",
    },
    voices: {
        title: "Voice Library",
        icon: AudioLines,
        closeHref: "/dashboard",
        description: "Cloned and library voices for podcast generation.",
        category: "workspace",
    },
    podcast: {
        title: "Podcast Studio",
        icon: Headphones,
        closeHref: "/dashboard",
        description: "Generate, manage, and publish podcast episodes.",
        category: "workspace",
    },
    popups: {
        title: "Popups",
        icon: Megaphone,
        closeHref: "/dashboard",
        description: "Timed and exit-intent popups for newsletter and booking.",
        category: "workspace",
    },
    "case-snippets": {
        title: "Case Snippets",
        icon: BookOpen,
        closeHref: "/dashboard",
        description: "Real client anecdotes the AI blog writer weaves into drafts.",
        category: "workspace",
    },
    videos: {
        title: "Videos",
        icon: Video,
        closeHref: "/dashboard",
        description: "Upload, manage, and publish videos to the public /videos page.",
        category: "workspace",
    },
    // ─── Productivity apps ──────────────────────────────────────────────
    // Not gated by workspace tier or capability — available to any signed-
    // in user. Live under the Start menu rather than the desktop grid by
    // default to keep the desktop focused on business apps.
    notes: {
        title: "Notes",
        icon: PenSquare,
        closeHref: "/dashboard",
        description: "Quick personal notes saved to your workspace.",
        category: "productivity",
    },
    calculator: {
        title: "Calculator",
        icon: Calculator,
        closeHref: "/dashboard",
        description: "Quick arithmetic without leaving the desktop.",
        category: "productivity",
    },
    recorder: {
        title: "Voice Memo",
        icon: Mic,
        closeHref: "/dashboard",
        description: "Record and save quick voice memos.",
        category: "productivity",
    },
};

/**
 * Resolve the active window's meta from a full dashboard pathname.
 * Returns null when the path is the desktop view itself (or nested deeper
 * than one segment — e.g. /dashboard/content/[id] inherits from content).
 */
export function resolveWindowMeta(pathname: string): WindowMeta | null {
    if (!pathname.startsWith("/dashboard")) return null;
    if (pathname === "/dashboard" || pathname === "/dashboard/") return null;

    const remainder = pathname.slice("/dashboard/".length);
    const firstSegment = remainder.split("/")[0] ?? "";
    if (!firstSegment) return null;

    return WINDOW_META[firstSegment] ?? null;
}

/**
 * List of all app entries suitable for rendering on the desktop icon grid.
 * Stable ordering — alphabetical by title — keeps the icon grid visually
 * predictable across workspaces (filtering for role/capability happens at
 * the shell level, not here).
 */
export function listDesktopApps(): Array<WindowMeta & { slug: string; href: string }> {
    return Object.entries(WINDOW_META)
        .map(([slug, meta]) => ({
            ...meta,
            slug,
            href: `/dashboard/${slug}`,
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Productivity apps — always available, rendered under the Start menu's
 * productivity section. Separate from the workspace apps (which are
 * role/tier/capability filtered against state.modules).
 */
export function listProductivityApps(): Array<WindowMeta & { slug: string; href: string }> {
    return Object.entries(WINDOW_META)
        .filter(([, meta]) => meta.category === "productivity")
        .map(([slug, meta]) => ({
            ...meta,
            slug,
            href: `/dashboard/${slug}`,
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
}
