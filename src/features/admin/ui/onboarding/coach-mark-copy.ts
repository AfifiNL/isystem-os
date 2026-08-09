// First-window-open tips, keyed by the dashboard route segment (the same
// key as the DashboardModule.key). Pure data — kept here so the WindowFrame
// stays a thin client component and so a future translation pass can swap
// in dictionary lookups without touching shell logic.

export interface CoachMarkCopy {
    title: string;
    body: string;
}

export const COACH_MARK_COPY: Record<string, CoachMarkCopy> = {
    content: {
        title: "Filter, then act",
        body: "Use the status, locale, and source filters at the top to narrow the library before bulk-publishing or scheduling.",
    },
    generate: {
        title: "Pick your locale first",
        body: "Locale drives prompts, voices, and SEO targets. Set it before generating so the orchestrator picks the right pipeline.",
    },
    "manual-posts": {
        title: "Same library, different lens",
        body: "This is a filtered view of the unified content library showing only manually-authored posts. Switch back via the filter chip.",
    },
    builder: {
        title: "Constrained by design",
        body: "Only design-system blocks are available. That's intentional — pages stay on-brand even when many editors contribute.",
    },
    podcast: {
        title: "Reuse music beds",
        body: "Attach intros, beds, and outros from the Music Library so episodes share a consistent audio identity.",
    },
    "music-library": {
        title: "Upload once, attach anywhere",
        body: "Tracks here are reusable across podcast episodes. Tag intros, beds, and outros so the studio can pick the right segment.",
    },
    voices: {
        title: "Library + cloned voices",
        body: "Library voices are vetted ElevenLabs presets. Cloned voices are workspace-specific — manage consent and labels here.",
    },
    popups: {
        title: "Triggers matter more than copy",
        body: "Pick the right trigger (timed, exit-intent, scroll-depth) before tweaking the copy. Conversion lifts from triggers, not adjectives.",
    },
    seo: {
        title: "Plan, apply, rollback",
        body: "Every SEO change is staged as a plan you can apply or roll back. Run the audit first, then approve safe-to-apply suggestions.",
    },
    newsletter: {
        title: "Audiences before campaigns",
        body: "Set up your audiences and templates first — campaigns reference them. Analytics show up after the first send.",
    },
    analytics: {
        title: "Workspace-scoped traffic",
        body: "All metrics are scoped to this workspace. Use the date range and dimension filters to narrow before exporting CSV.",
    },
    booking: {
        title: "Availability rules drive everything",
        body: "Configure availability rules first — the public picker, intake, and reservations all read from them.",
    },
    clients: {
        title: "One row per portal client",
        body: "Each row links a portal account to a workspace. Use this view to spot dormant clients and continuity gaps.",
    },
    slas: {
        title: "Locations group SLAs",
        body: "Add facility locations first, then attach SLAs. Per-location reporting depends on this hierarchy.",
    },
    "render-queue": {
        title: "Cross-workspace fulfillment",
        body: "This queue is global — admins fulfill manual video tasks across every workspace they manage.",
    },
    opportunities: {
        title: "Run weekly, not daily",
        body: "The engine sequences signals over a week to surface durable wins. Daily runs surface noise.",
    },
    "market-monitor": {
        title: "Set the watchlist once",
        body: "Configure competitors, authority sources, and keywords up front. Weekly digests then update without further setup.",
    },
    settings: {
        title: "Re-run the tour anytime",
        body: "The Onboarding panel here lets you replay the welcome tour and reset coach marks for this workspace.",
    },
    "admin-workspaces": {
        title: "Admin-only governance",
        body: "Create workspaces, attach themes, and assign managers. Manager assignments are exclusive — one active workspace per manager.",
    },
};
