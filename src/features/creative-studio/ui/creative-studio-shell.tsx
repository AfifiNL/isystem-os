"use client";

import { useActionState } from "react";
import {
    Boxes,
    Brush,
    CheckCircle2,
    Clock3,
    ClipboardCopy,
    ExternalLink,
    FileText,
    Film,
    History,
    Layers3,
    Palette,
    Plus,
    Settings2,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import {
    AppMetric,
    AppMetricStrip,
    DashboardAppWorkbench,
} from "@/features/admin/ui/app-workbench";
import {
    approveMcpManualResultAction,
    attachMcpManualExternalUrlAction,
    createMcpManualRenderJobAction,
    createCreativeBriefAction,
    createCreativeProjectAction,
    generateCreativeStrategyAction,
    markMcpGenerationStartedManuallyAction,
    recordMcpCommandCopiedAction,
    rejectMcpManualResultAction,
    uploadMcpManualResultAction,
    type CreativeStudioActionState,
    type CreativeStudioDashboardData,
    type CreativeMcpManualFulfillmentSummary,
} from "@/features/creative-studio/actions";

const initialActionState: CreativeStudioActionState = { ok: false, error: null };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="grid gap-1.5 text-[13px] font-medium text-foreground">
            <span>{label}</span>
            {children}
        </label>
    );
}

function inputClassName(extra = "") {
    return `min-h-9 rounded-md border border-border/70 bg-background px-3 py-2 text-[14px] text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15 ${extra}`;
}

function PlaceholderPanel({
    title,
    description,
    icon: Icon,
    children,
}: {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    children?: React.ReactNode;
}) {
    return (
        <section className="rounded-xl border border-border/60 bg-card/55 p-4 shadow-sm">
            <div className="mb-3 flex items-start gap-3">
                <div className="rounded-lg border border-border/60 bg-background p-2 text-muted-foreground">
                    <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
                    <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p>
                </div>
            </div>
            {children ?? (
                <div className="rounded-lg border border-dashed border-border/70 bg-background/45 p-3 text-[13px] text-muted-foreground">
                    Phase 4 shell only — workflow data and provider execution land in later phases.
                </div>
            )}
        </section>
    );
}

function StatusBadge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "warning" }) {
    const toneClass = tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : tone === "warning"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-border/70 bg-background/70 text-muted-foreground";

    return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-medium ${toneClass}`}>{children}</span>;
}

function ProjectForm({ locale }: { locale: string }) {
    const [state, formAction, pending] = useActionState(createCreativeProjectAction, initialActionState);

    return (
        <form action={formAction} className="grid gap-3 rounded-xl border border-border/60 bg-card/55 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-[15px] font-semibold text-foreground">New creative project</h2>
                    <p className="text-[13px] text-muted-foreground">Create a scoped campaign container. No render job is submitted.</p>
                </div>
                <StatusBadge>CRUD only</StatusBadge>
            </div>
            <input type="hidden" name="locale" value={locale} />
            <Field label="Project name">
                <input name="name" required maxLength={160} className={inputClassName()} placeholder="Q3 authority video campaign" />
            </Field>
            <Field label="Objective">
                <textarea name="objective" required rows={3} maxLength={2000} className={inputClassName("resize-none")} placeholder="What should this creative project achieve?" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Target audience">
                    <input name="target_audience" maxLength={1000} className={inputClassName()} placeholder="Founders, operators, B2B buyers" />
                </Field>
                <Field label="Target channel">
                    <input name="target_channel" maxLength={120} className={inputClassName()} placeholder="LinkedIn, newsletter, landing page" />
                </Field>
            </div>
            {state.error ? <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-600">{state.error}</p> : null}
            {state.ok ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700">Project created.</p> : null}
            <button type="submit" disabled={pending} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[14px] font-semibold text-primary-foreground disabled:opacity-60">
                <Plus className="size-4" /> {pending ? "Creating…" : "Create project"}
            </button>
        </form>
    );
}

function BriefForm({ projects }: { projects: CreativeStudioDashboardData["projects"] }) {
    const [state, formAction, pending] = useActionState(createCreativeBriefAction, initialActionState);
    const hasProjects = projects.length > 0;

    return (
        <form action={formAction} className="grid gap-3 rounded-xl border border-border/60 bg-card/55 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-[15px] font-semibold text-foreground">New creative brief</h2>
                    <p className="text-[13px] text-muted-foreground">Capture source-grounded intent for later strategy and prompt manifests.</p>
                </div>
                <StatusBadge>Safe draft</StatusBadge>
            </div>
            <Field label="Project">
                <select name="project_id" required disabled={!hasProjects} className={inputClassName()}>
                    {hasProjects ? projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                    )) : <option value="">Create a project first</option>}
                </select>
            </Field>
            <Field label="Brief title">
                <input name="title" required maxLength={180} disabled={!hasProjects} className={inputClassName()} placeholder="Founder-led AI orchestration explainer" />
            </Field>
            <Field label="Brief markdown">
                <textarea name="brief_markdown" required rows={5} maxLength={8000} disabled={!hasProjects} className={inputClassName("resize-none")} placeholder="Audience, message, claims, proof, CTA, rights constraints…" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Source module">
                    <input name="source_module" disabled={!hasProjects} maxLength={80} className={inputClassName()} defaultValue="creative_studio" />
                </Field>
                <Field label="Target URL">
                    <input name="target_url" disabled={!hasProjects} type="url" className={inputClassName()} placeholder="https://example.com/campaign" />
                </Field>
            </div>
            {state.error ? <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-600">{state.error}</p> : null}
            {state.ok ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700">Brief created.</p> : null}
            <button type="submit" disabled={pending || !hasProjects} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border/70 bg-background px-3 text-[14px] font-semibold text-foreground disabled:opacity-60">
                <FileText className="size-4" /> {pending ? "Saving…" : "Save brief"}
            </button>
        </form>
    );
}

function StrategyForm({ briefs }: { briefs: CreativeStudioDashboardData["briefs"] }) {
    const [state, formAction, pending] = useActionState(generateCreativeStrategyAction, initialActionState);
    const candidates = briefs.filter((brief) => brief.status === "draft" || brief.status === "strategy_requested");
    const hasCandidates = candidates.length > 0;

    return (
        <form action={formAction} className="grid gap-3 rounded-lg border border-dashed border-border/70 bg-background/45 p-3 text-[13px] text-muted-foreground">
            <Field label="Brief to compile">
                <select name="brief_id" required disabled={!hasCandidates} className={inputClassName()}>
                    {hasCandidates ? candidates.map((brief) => (
                        <option key={brief.id} value={brief.id}>{brief.title}</option>
                    )) : <option value="">No draft briefs awaiting strategy</option>}
                </select>
            </Field>
            <p>Uses Vertex strategy with Source Intelligence evidence, persists prompt manifest, and does not queue renders.</p>
            {state.error ? <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-600">{state.error}</p> : null}
            {state.ok ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700">Strategy manifest generated.</p> : null}
            <button type="submit" disabled={pending || !hasCandidates} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[14px] font-semibold text-primary-foreground disabled:opacity-60">
                <Sparkles className="size-4" /> {pending ? "Generating…" : "Generate strategy"}
            </button>
        </form>
    );
}

function CreateMcpManualJobForm({ prompts }: { prompts: CreativeStudioDashboardData["prompts"] }) {
    const [state, formAction, pending] = useActionState(createMcpManualRenderJobAction, initialActionState);
    const hasPrompts = prompts.length > 0;

    return (
        <form action={formAction} className="grid gap-3 rounded-lg border border-dashed border-border/70 bg-background/45 p-3 text-[13px] text-muted-foreground">
            <Field label="Approved prompt/strategy">
                <select name="prompt_id" required disabled={!hasPrompts} className={inputClassName()}>
                    {hasPrompts ? prompts.map((prompt) => (
                        <option key={prompt.id} value={prompt.id}>{prompt.prompt_hash.slice(0, 12)} · {prompt.provider_prompt.slice(0, 72)}</option>
                    )) : <option value="">Generate a strategy prompt first</option>}
                </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Provider model">
                    <input name="provider_model" disabled={!hasPrompts} className={inputClassName()} defaultValue="higgsfield-operator-choice" />
                </Field>
                <Field label="Credit source">
                    <select name="manual_credit_source" disabled={!hasPrompts} className={inputClassName()} defaultValue="operator_creator_credits">
                        <option value="operator_creator_credits">Higgsfield creator plan</option>
                        <option value="client_creator_credits">Client creator plan</option>
                        <option value="unknown">Unknown / confirm before run</option>
                    </select>
                </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Job kind">
                    <select name="job_kind" disabled={!hasPrompts} className={inputClassName()} defaultValue="video">
                        <option value="video">Video</option>
                        <option value="image">Image</option>
                        <option value="storyboard">Storyboard</option>
                        <option value="social_cutdown">Social cutdown</option>
                    </select>
                </Field>
                <Field label="Duration seconds">
                    <input name="duration_seconds" disabled={!hasPrompts} type="number" min={1} max={60} className={inputClassName()} placeholder="8" />
                </Field>
            </div>
            <Field label="Operator notes">
                <textarea name="operator_notes" disabled={!hasPrompts} rows={2} maxLength={1000} className={inputClassName("resize-none")} placeholder="Manual fulfillment notes; never enter credentials." />
            </Field>
            <p>MCP Manual Mode stores only prompt/checklist metadata. It does not store MCP auth or call Higgsfield.</p>
            {state.error ? <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-600">{state.error}</p> : null}
            {state.ok ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700">MCP manual job created.</p> : null}
            <button type="submit" disabled={pending || !hasPrompts} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[14px] font-semibold text-primary-foreground disabled:opacity-60">
                <Film className="size-4" /> {pending ? "Creating…" : "Create MCP manual job"}
            </button>
        </form>
    );
}

function RightsSafetyAcknowledgement() {
    return (
        <div className="grid gap-2 rounded-lg border border-border/60 bg-background/55 p-3 text-[12px] text-muted-foreground">
            <label className="flex gap-2"><input name="rights_ack" type="checkbox" required className="mt-0.5" /> I confirm usage rights/source permissions for this manual result.</label>
            <label className="flex gap-2"><input name="safety_ack" type="checkbox" required className="mt-0.5" /> I confirm safety/brand review before upload or URL attachment.</label>
        </div>
    );
}

function ManualActionForm({
    action,
    children,
    submitLabel,
    icon: Icon,
}: {
    action: (prevState: CreativeStudioActionState, formData: FormData) => Promise<CreativeStudioActionState>;
    children: React.ReactNode;
    submitLabel: string;
    icon: React.ComponentType<{ className?: string }>;
}) {
    const [state, formAction, pending] = useActionState(action, initialActionState);
    return (
        <form action={formAction} className="grid gap-2">
            {children}
            {state.error ? <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-600">{state.error}</p> : null}
            {state.ok ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700">Saved.</p> : null}
            <button type="submit" disabled={pending} className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border/70 bg-background px-3 text-[13px] font-semibold text-foreground disabled:opacity-60">
                <Icon className="size-3.5" /> {pending ? "Saving…" : submitLabel}
            </button>
        </form>
    );
}

function McpManualJobCard({ item }: { item: CreativeMcpManualFulfillmentSummary }) {
    const providerModeLabel = item.job.provider_mode === "fake" ? "Fake" : item.job.provider_mode === "api_auto" ? "API Auto" : "MCP Manual";
    const creditLabel = item.job.provider_mode === "mcp_manual" ? "Higgsfield creator plan" : "API budget";
    const nextActionLabel = item.nextAction === "copy_mcp_command" ? "Copy MCP command" : item.nextAction === "upload_result" ? "Upload result" : item.nextAction === "review_asset" ? "Review asset" : "Complete";

    return (
        <article className="grid gap-3 rounded-lg border border-border/60 bg-background/55 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold text-foreground">Manual job {item.job.id.slice(0, 8)}</h3>
                    <p className="text-[12px] text-muted-foreground">Server URL: https://mcp.higgsfield.ai/mcp</p>
                </div>
                <StatusBadge tone={item.asset?.status === "approved" ? "success" : "warning"}>{item.job.status.replaceAll("_", " ")}</StatusBadge>
            </div>
            <div className="grid gap-2 text-[12px] text-muted-foreground sm:grid-cols-3">
                <div className="rounded-md border border-border/60 bg-card/50 p-2"><span className="block uppercase tracking-wide">Provider mode</span><strong className="text-foreground">{providerModeLabel}</strong></div>
                <div className="rounded-md border border-border/60 bg-card/50 p-2"><span className="block uppercase tracking-wide">Credit source</span><strong className="text-foreground">{creditLabel}</strong></div>
                <div className="rounded-md border border-border/60 bg-card/50 p-2"><span className="block uppercase tracking-wide">Next action</span><strong className="text-foreground">{nextActionLabel}</strong></div>
            </div>
            <ol className="grid gap-1 rounded-md border border-border/60 bg-card/50 p-3 text-[12px] leading-5 text-muted-foreground">
                <li>1. Connect MCP host to <strong>https://mcp.higgsfield.ai/mcp</strong>.</li>
                <li>2. Copy the command below into Claude/MCP host manually.</li>
                <li>3. Run using the operator&apos;s signed-in Higgsfield account.</li>
                <li>4. Download the result locally.</li>
                <li>5. Upload into the workspace or attach a safe external URL.</li>
                <li>6. Review/approve, then hand off manually.</li>
            </ol>
            <textarea readOnly value={item.commandText ?? "Production pack unavailable for this job."} rows={10} className={inputClassName("resize-y font-mono text-[12px]")} />
            <ManualActionForm action={recordMcpCommandCopiedAction} submitLabel="Record command copied" icon={ClipboardCopy}>
                <input type="hidden" name="job_id" value={item.job.id} />
                <input type="hidden" name="command_text" value={item.commandText ?? ""} />
            </ManualActionForm>
            <ManualActionForm action={markMcpGenerationStartedManuallyAction} submitLabel="Mark manual generation started" icon={Clock3}>
                <input type="hidden" name="job_id" value={item.job.id} />
            </ManualActionForm>
            <ManualActionForm action={attachMcpManualExternalUrlAction} submitLabel="Attach external URL" icon={ExternalLink}>
                <input type="hidden" name="job_id" value={item.job.id} />
                <Field label="External result URL">
                    <input name="manual_external_url" type="url" className={inputClassName()} defaultValue={item.job.manual_external_url ?? ""} placeholder="https://…" />
                </Field>
                <RightsSafetyAcknowledgement />
            </ManualActionForm>
            <ManualActionForm action={uploadMcpManualResultAction} submitLabel="Upload manual result" icon={Brush}>
                <input type="hidden" name="job_id" value={item.job.id} />
                <Field label="Downloaded result file">
                    <input name="result_file" type="file" accept="image/*,video/*,.json" className={inputClassName()} />
                </Field>
                <RightsSafetyAcknowledgement />
            </ManualActionForm>
            {item.asset ? (
                <div className="grid gap-2 rounded-lg border border-border/60 bg-card/50 p-3">
                    <p className="text-[12px] text-muted-foreground">Asset stored privately in <strong>{item.asset.storage_bucket}</strong>: {item.asset.storage_path}. No public URL is faked.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <ManualActionForm action={approveMcpManualResultAction} submitLabel="Approve result" icon={CheckCircle2}>
                            <input type="hidden" name="job_id" value={item.job.id} />
                            <input type="hidden" name="asset_id" value={item.asset.id} />
                            <RightsSafetyAcknowledgement />
                        </ManualActionForm>
                        <ManualActionForm action={rejectMcpManualResultAction} submitLabel="Reject result" icon={ShieldCheck}>
                            <input type="hidden" name="job_id" value={item.job.id} />
                            <input type="hidden" name="asset_id" value={item.asset.id} />
                            <Field label="Rejection notes"><input name="notes" className={inputClassName()} placeholder="Reason for rejection" /></Field>
                        </ManualActionForm>
                    </div>
                </div>
            ) : null}
        </article>
    );
}

function McpManualFulfillmentPanel({ data }: { data: CreativeStudioDashboardData }) {
    return (
        <PlaceholderPanel title="MCP Manual Fulfillment" icon={Film} description="Operator-controlled Higgsfield MCP workflow. The workspace remains the system of record; generation happens manually in the operator's MCP host.">
            <div className="grid gap-4">
                <CreateMcpManualJobForm prompts={data.prompts} />
                {data.mcpManual.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border/70 bg-background/45 p-3 text-[13px] text-muted-foreground">No MCP Manual jobs yet. Create one from an approved strategy prompt.</p>
                ) : data.mcpManual.map((item) => <McpManualJobCard key={item.job.id} item={item} />)}
            </div>
        </PlaceholderPanel>
    );
}

export function CreativeStudioShell({ data }: { data: CreativeStudioDashboardData }) {
    const providerTone = data.providerStatus.higgsfieldReady ? "success" : "warning";

    return (
        <DashboardAppWorkbench>
            <AppMetricStrip>
                <AppMetric label="Projects" value={data.stats.projects} icon={Palette} />
                <AppMetric label="Briefs" value={data.stats.briefs} icon={FileText} />
                <AppMetric label="Pending queue" value={data.stats.queuedJobs} icon={Clock3} variant={data.stats.queuedJobs > 0 ? "warning" : "default"} />
                <AppMetric label="Failures" value={data.stats.failures} icon={CheckCircle2} variant={data.stats.failures > 0 ? "warning" : "default"} />
                <AppMetric label="Assets" value={data.stats.assets} icon={Boxes} />
                <AppMetric label="Approvals" value={data.stats.approvals} icon={CheckCircle2} />
                <AppMetric label="Exports" value={data.stats.exports} icon={Layers3} />
                <AppMetric label="Audit events" value={data.stats.auditEvents} icon={History} />
                <AppMetric label="Spend" value={`$${(data.stats.spendMillicents / 100000).toFixed(2)}`} icon={Settings2} />
            </AppMetricStrip>

            <div data-creative-studio-status="true" className="flex flex-wrap items-center gap-2 px-4 pt-3">
                <StatusBadge tone="success">Pro workspace</StatusBadge>
                <StatusBadge tone={providerTone}>{data.providerStatus.higgsfieldReady ? "Provider ready" : "Provider gated"}</StatusBadge>
                <StatusBadge tone="warning">MCP manual</StatusBadge>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                    <div className="grid gap-4">
                        <section className="rounded-xl border border-border/60 bg-card/55 p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-[15px] font-semibold text-foreground">Briefs</h2>
                                    <p className="text-[13px] text-muted-foreground">Recent scoped projects and briefs. Reads are filtered by workspace, template, and locale context.</p>
                                </div>
                                <StatusBadge>{data.workspace.locale.toUpperCase()}</StatusBadge>
                            </div>
                            <div className="grid gap-3">
                                {data.projects.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border/70 bg-background/45 p-4 text-[13px] text-muted-foreground">
                                        No creative projects yet. Create one to unlock brief intake.
                                    </div>
                                ) : data.projects.map((project) => (
                                    <article key={project.id} className="rounded-lg border border-border/60 bg-background/55 p-3">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="truncate text-[14px] font-semibold text-foreground">{project.name}</h3>
                                                <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{project.objective}</p>
                                            </div>
                                            <StatusBadge>{project.status.replaceAll("_", " ")}</StatusBadge>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <ProjectForm locale={data.workspace.locale} />
                            <BriefForm projects={data.projects} />
                        </div>

                        <section className="rounded-xl border border-border/60 bg-card/55 p-4 shadow-sm">
                            <h2 className="text-[15px] font-semibold text-foreground">Recent briefs</h2>
                            <div className="mt-3 grid gap-2">
                                {data.briefs.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-border/70 bg-background/45 p-3 text-[13px] text-muted-foreground">No briefs saved yet.</p>
                                ) : data.briefs.map((brief) => (
                                    <article key={brief.id} className="rounded-lg border border-border/60 bg-background/55 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <h3 className="text-[14px] font-semibold text-foreground">{brief.title}</h3>
                                            <StatusBadge>{brief.status.replaceAll("_", " ")}</StatusBadge>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{brief.brief_markdown}</p>
                                    </article>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="grid content-start gap-4">
                        <PlaceholderPanel title="Strategy" icon={Sparkles} description="Vertex strategy output compiles source-grounded prompt manifests. Human approval is required before any render queueing.">
                            <StrategyForm briefs={data.briefs} />
                        </PlaceholderPanel>
                        <McpManualFulfillmentPanel data={data} />
                        <PlaceholderPanel title="Prompt manifests" icon={Layers3} description="Immutable prompt lineage for manual or API-backed provider prompt compilation.">
                            <div className="grid gap-2 text-[13px] text-muted-foreground">
                                {data.prompts.length === 0 ? <p>No prompt manifests yet.</p> : data.prompts.map((prompt) => (
                                    <div key={prompt.id} className="rounded-lg border border-border/60 bg-background/55 p-3">
                                        <strong className="text-foreground">{prompt.prompt_hash.slice(0, 16)}</strong>
                                        <p className="line-clamp-2">{prompt.provider_prompt}</p>
                                    </div>
                                ))}
                            </div>
                        </PlaceholderPanel>
                        <PlaceholderPanel title="Queue" icon={Film} description="Render queue visibility across API Auto, MCP Manual, and Fake modes.">
                            <div className="grid gap-2 text-[13px] text-muted-foreground">
                                {data.renderJobs.length === 0 ? <p>No render jobs yet.</p> : data.renderJobs.map((job) => (
                                    <div key={job.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/55 p-3">
                                        <span>{job.provider_mode.replaceAll("_", " ")} · {job.provider_model}</span>
                                        <StatusBadge>{job.status.replaceAll("_", " ")}</StatusBadge>
                                    </div>
                                ))}
                            </div>
                        </PlaceholderPanel>
                        <PlaceholderPanel title="Assets" icon={Brush} description="Generated asset library. Creative renders stay private in storage; public URLs are not faked.">
                            <div className="grid gap-2 text-[13px] text-muted-foreground">
                                {data.assets.length === 0 ? <p>No assets uploaded yet.</p> : data.assets.map((asset) => (
                                    <div key={asset.id} className="rounded-lg border border-border/60 bg-background/55 p-3">
                                        <div className="flex items-center justify-between gap-2"><span>{asset.asset_type}</span><StatusBadge>{asset.status}</StatusBadge></div>
                                        <p className="mt-1 break-all text-[12px]">{asset.storage_bucket}/{asset.storage_path}</p>
                                    </div>
                                ))}
                            </div>
                        </PlaceholderPanel>
                        <PlaceholderPanel title="Audit timeline" icon={History} description="Append-only review and safety event timeline placeholder." />
                        <PlaceholderPanel title="Settings / provider status" icon={Settings2} description="Provider readiness display without invoking provider APIs.">
                            <div className="grid gap-2 text-[13px] text-muted-foreground">
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/55 px-3 py-2">
                                    <span>Fake provider</span>
                                    <StatusBadge tone={data.providerStatus.fakeProviderEnabled ? "success" : "warning"}>{data.providerStatus.fakeProviderEnabled ? "Enabled" : "Disabled"}</StatusBadge>
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/55 px-3 py-2">
                                    <span>Higgsfield API Auto</span>
                                    <StatusBadge tone={providerTone}>{data.providerStatus.higgsfieldReady ? "Ready" : "Disabled / fail-closed"}</StatusBadge>
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/55 px-3 py-2">
                                    <span>Higgsfield MCP Manual Mode</span>
                                    <StatusBadge tone="warning">{data.providerStatus.mcpManualStatusLabel}</StatusBadge>
                                </div>
                                <p className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-3 text-sky-800 dark:text-sky-200">
                                    {data.providerStatus.mcpManualStatusDetail}
                                </p>
                                {data.providerStatus.higgsfieldDisabledReason ? (
                                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
                                        {data.providerStatus.higgsfieldDisabledReason}
                                    </p>
                                ) : null}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-lg border border-border/60 bg-background/55 p-3">
                                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Worker drain</div>
                                        <div className="text-[17px] font-semibold text-foreground">{data.providerStatus.workerDrainLimit}</div>
                                    </div>
                                    <div className="rounded-lg border border-border/60 bg-background/55 p-3">
                                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Daily cap</div>
                                        <div className="text-[17px] font-semibold text-foreground">{data.providerStatus.dailyRenderLimitPerWorkspace}</div>
                                    </div>
                                </div>
                            </div>
                        </PlaceholderPanel>
                    </div>
                </div>
            </div>
        </DashboardAppWorkbench>
    );
}

export function CreativeStudioUnavailable({ reason }: { reason: string }) {
    return (
        <DashboardAppWorkbench>
            <div className="grid min-h-0 flex-1 place-items-center p-6">
                <div className="max-w-lg rounded-2xl border border-border/70 bg-card/65 p-6 text-center shadow-sm">
                    <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
                    <h2 className="mt-3 text-lg font-semibold text-foreground">Pro-gated creative workspace</h2>
                    <p className="mt-2 text-[14px] leading-6 text-muted-foreground">{reason}</p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1 text-[13px] text-muted-foreground">
                        <CheckCircle2 className="size-4" /> Provider calls are disabled in this phase.
                    </div>
                </div>
            </div>
        </DashboardAppWorkbench>
    );
}
