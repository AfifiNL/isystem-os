"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { assertWorkspaceAiEnabled, assertWorkspaceAdminOrManager, resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { assertSufficientAiBalance, checkAiRateLimitPg, meterAndCharge } from "@/shared/lib/ai/metering";
import { transcribeAudio, type TranscriptionResult } from "@/shared/lib/ai/transcribe";
import { normalizeAiProviderError, runWithWorkspaceAiConfig } from "@/shared/lib/ai/provider";
import { syncSemanticNode, syncSemanticNodeWithClient } from "@/shared/lib/semantic-hub/sync";
import { createOrUpdateVoiceMemoGeneratedNote, createOrUpdateVoiceMemoGeneratedNoteWithAdminClient } from "@/features/productivity/notes/voice-memo-generated-note";
import { buildVoiceMemoCommitmentFingerprint, calculateVoiceMemoRetryAt, toSafeVoiceMemoProcessingError } from "./processing";

const BUCKET = "workspace-voice-memos";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — keeps a 30s-2min memo well under cap
const TRANSCRIPTION_ROUTE = "voice_memo_transcription";

export interface VoiceMemoSummaryJson {
    summary?: string;
    commitments?: TranscriptionResult["commitments"];
    error?: string;
}

export interface VoiceMemoRecord {
    id: string;
    title: string;
    storage_path: string;
    duration_seconds: number;
    mime_type: string;
    transcript: string | null;
    summary_json: VoiceMemoSummaryJson | null;
    processed_at: string | null;
    processing_status: "pending" | "processing" | "processed" | "error" | null;
    processing_error: string | null;
    attempt_count: number;
    last_attempted_at: string | null;
    next_retry_at: string | null;
    target_project_id: string | null;
    created_at: string;
    signed_url: string | null;
}

export interface ClientProjectOption {
    id: string;
    name: string;
    client_name: string | null;
}

async function currentUserAndWorkspace(): Promise<{ userId: string; workspaceId: string } | { error: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not signed in." };

    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) return { error: "No active workspace." };

    return { userId: user.id, workspaceId: ctx.activeWorkspace.id };
}

export async function listVoiceMemos(): Promise<{ data: VoiceMemoRecord[]; error: string | null }> {
    const ctx = await currentUserAndWorkspace();
    if ("error" in ctx) return { data: [], error: ctx.error };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_voice_memos")
        .select("id,title,storage_path,duration_seconds,mime_type,transcript,summary_json,processed_at,processing_status,processing_error,attempt_count,last_attempted_at,next_retry_at,target_project_id,created_at")
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.userId)
        .order("created_at", { ascending: false })
        .limit(50);

    if (error) return { data: [], error: error.message };

    // Sign URLs so the client can play audio without exposing the bucket
    // publicly. 1 hour TTL — plenty for a listening session, short enough
    // that a leaked URL cannot be replayed indefinitely.
    const signed = await Promise.all(
        (data ?? []).map(async (row) => {
            const { data: signedData } = await supabase.storage
                .from(BUCKET)
                .createSignedUrl(row.storage_path, 60 * 60);
            return {
                ...row,
                signed_url: signedData?.signedUrl ?? null,
            } as VoiceMemoRecord;
        }),
    );

    return { data: signed, error: null };
}

type RecorderSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type RecorderAdminSupabaseClient = ReturnType<typeof createAdminClient>;
type VoiceMemoProcessingClient = RecorderSupabaseClient;

interface VoiceMemoProcessingContext {
    workspaceId: string;
    userId: string;
    supabase: VoiceMemoProcessingClient;
    isAdminClient?: boolean;
}

async function resolveDefaultProjectId(supabase: VoiceMemoProcessingClient, workspaceId: string): Promise<string> {
    const { data: project } = await supabase
        .from("workspace_client_projects")
        .select("id")
        .eq("workspace_id", workspaceId)
        .limit(1)
        .maybeSingle();

    if (project) {
        return project.id;
    }

    const { data: client } = await supabase
        .from("client_portal_users")
        .select("id")
        .eq("workspace_id", workspaceId)
        .limit(1)
        .maybeSingle();

    let clientId: string;
    if (client) {
        clientId = client.id;
    } else {
        const { data: newClient, error: clientErr } = await supabase
            .from("client_portal_users")
            .insert({
                workspace_id: workspaceId,
                profile_id: null,
                company_name: "Internal Team",
            })
            .select("id")
            .single();

        if (clientErr || !newClient) {
            throw new Error(`Failed to create default client portal user: ${clientErr?.message}`);
        }
        clientId = newClient.id;
    }

    const { data: newProject, error: projectErr } = await supabase
        .from("workspace_client_projects")
        .insert({
            workspace_id: workspaceId,
            client_id: clientId,
            name: "General Operations",
        })
        .select("id")
        .single();

    if (projectErr || !newProject) {
        throw new Error(`Failed to create default project: ${projectErr?.message}`);
    }

    return newProject.id;
}

async function resolveScopedProjectId(supabase: VoiceMemoProcessingClient, workspaceId: string, projectId: string | null): Promise<string | null> {
    const trimmed = projectId?.trim() || null;
    if (!trimmed) return null;

    const { data } = await supabase
        .from("workspace_client_projects")
        .select("id")
        .eq("id", trimmed)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

    return data?.id ?? null;
}

export async function listClientProjects(): Promise<{ data: ClientProjectOption[]; error: string | null }> {
    try {
        const context = await assertWorkspaceAdminOrManager();
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("workspace_client_projects")
            .select("id, name, client_portal_users(company_name)")
            .eq("workspace_id", context.activeWorkspace.id)
            .order("created_at", { ascending: false });

        if (error) return { data: [], error: error.message };

        return {
            data: (data ?? []).map((row) => {
                const client = Array.isArray(row.client_portal_users)
                    ? row.client_portal_users[0]
                    : row.client_portal_users;
                return {
                    id: row.id,
                    name: row.name,
                    client_name: client?.company_name ?? null,
                };
            }),
            error: null,
        };
    } catch (err) {
        return { data: [], error: err instanceof Error ? err.message : "Failed to load client projects." };
    }
}

async function indexExtractedTasks(params: {
    supabase: VoiceMemoProcessingClient;
    workspaceId: string;
    userId: string;
    memoId: string;
    projectId: string;
    commitments: TranscriptionResult["commitments"];
    useAdminClient?: boolean;
}) {
    for (const commitment of params.commitments) {
        const sourceFingerprint = buildVoiceMemoCommitmentFingerprint(commitment);
        const { data: existingTask } = await params.supabase
            .from("workspace_sla_tasks")
            .select("id")
            .eq("project_id", params.projectId)
            .eq("source_kind", "voice_memo_transcription")
            .eq("source_voice_memo_id", params.memoId)
            .eq("source_fingerprint", sourceFingerprint)
            .maybeSingle();

        if (existingTask) {
            continue;
        }

        const { data: task, error: taskError } = await params.supabase
            .from("workspace_sla_tasks")
            .insert({
                project_id: params.projectId,
                task_name: commitment.title,
                category: commitment.priority === "high" ? "priority_follow_up" : "meeting_follow_up",
                frequency_kind: "on_demand",
                status: "pending",
                grace_period_days: 0,
                source_kind: "voice_memo_transcription",
                source_voice_memo_id: params.memoId,
                source_fingerprint: sourceFingerprint,
            })
            .select("id")
            .single();

        if (taskError || !task) {
            console.error("Failed to insert SLA task for commitment:", taskError?.message);
            continue;
        }

        if (commitment.description) {
            const { error: noteError } = await params.supabase
                .from("workspace_sla_task_notes")
                .insert({
                    sla_task_id: task.id,
                    workspace_id: params.workspaceId,
                    author_profile_id: params.userId,
                    author_kind: "workspace_manager",
                    body: commitment.description,
                    is_flag: false,
                    is_resolution: false,
                });
            if (noteError) {
                console.error("Failed to insert note for SLA task:", noteError.message);
            }
        }

        const semanticPayload = {
            workspaceId: params.workspaceId,
            entityType: "sla_task",
            entityId: task.id,
            title: commitment.title,
            content: `[SLA Task: ${commitment.title}]\nStatus: pending\nPriority: ${commitment.priority}\nDescription: ${commitment.description}`,
            metadata: {
                workspace_id: params.workspaceId,
                project_id: params.projectId,
                priority: commitment.priority,
                memo_id: params.memoId,
                source: "voice_memo_transcription",
            },
        } as const;
        if (params.useAdminClient) {
            await syncSemanticNodeWithClient({ supabase: params.supabase as unknown as RecorderAdminSupabaseClient, ...semanticPayload });
        } else {
            await syncSemanticNode(semanticPayload);
        }
    }
}

export async function processVoiceMemoTranscription(memoId: string, targetProjectId?: string | null): Promise<{ error: string | null }> {
    let supabase: RecorderSupabaseClient | null = null;
    let scopedMemoId: string | null = null;
    let scopedWorkspaceId: string | null = null;
    let currentAttemptCount = 0;

    try {
        const context = await assertWorkspaceAiEnabled();
        await assertWorkspaceAdminOrManager();

        supabase = await createClient();
        const { data: memo, error: memoError } = await supabase
            .from("workspace_voice_memos")
            .select("id,title,storage_path,duration_seconds,mime_type,transcript,processed_at,processing_status,attempt_count,target_project_id")
            .eq("id", memoId)
            .eq("workspace_id", context.activeWorkspace.id)
            .maybeSingle();

        if (memoError) return { error: memoError.message };
        if (!memo) return { error: "Voice memo not found." };

        if (memo.processed_at && memo.transcript && memo.processing_status === "processed") {
            return { error: null };
        }

        scopedMemoId = memo.id;
        scopedWorkspaceId = context.activeWorkspace.id;
        currentAttemptCount = (memo.attempt_count ?? 0) + 1;

        const { error: markProcessingError } = await supabase
            .from("workspace_voice_memos")
            .update({
                processing_status: "processing",
                processing_error: null,
                attempt_count: currentAttemptCount,
                last_attempted_at: new Date().toISOString(),
                next_retry_at: null,
            })
            .eq("id", memo.id)
            .eq("workspace_id", context.activeWorkspace.id);

        if (markProcessingError) return { error: markProcessingError.message };

        const rate = await checkAiRateLimitPg(context.activeWorkspace.id, TRANSCRIPTION_ROUTE, { maxPerWindow: 10 });
        if (!rate.allowed) throw new Error("Voice memo transcription rate limit reached. Please retry shortly.");

        const { data: audioData, error: downloadError } = await supabase.storage
            .from(BUCKET)
            .download(memo.storage_path);

        if (downloadError || !audioData) {
            throw new Error(downloadError?.message ?? "Failed to download voice memo audio.");
        }

        const audioBuffer = await audioData.arrayBuffer();
        const transcriptionResult = await transcribeAudio({
            audioBuffer,
            mimeType: memo.mime_type || "audio/webm",
            durationSeconds: memo.duration_seconds,
        });

        const usage = transcriptionResult.billing.unitType === "speech_seconds"
            ? {
                unitType: "speech_seconds" as const,
                model: transcriptionResult.billing.modelId,
                durationSeconds: transcriptionResult.billing.durationSeconds ?? Math.max(1, memo.duration_seconds ?? 60),
            }
            : {
                unitType: "tokens" as const,
                model: transcriptionResult.billing.modelId,
                tokensIn: transcriptionResult.billing.tokensIn ?? Math.max(1, Math.ceil((memo.duration_seconds ?? 60) * 16)),
                tokensOut: transcriptionResult.billing.tokensOut ?? Math.max(1, Math.ceil((transcriptionResult.transcript.length + transcriptionResult.summary.length) / 4)),
            };

        await meterAndCharge({
            workspaceId: context.activeWorkspace.id,
            profileId: context.userId,
            route: TRANSCRIPTION_ROUTE,
            usage,
            metadata: {
                memo_id: memo.id,
                duration_seconds: memo.duration_seconds,
                billable_duration_seconds: usage.unitType === "speech_seconds" ? usage.durationSeconds : undefined,
                fallback_used: transcriptionResult.billing.fallbackUsed,
                speech_model_id: transcriptionResult.billing.speechModelId,
                summary_model_id: transcriptionResult.billing.summaryModelId,
                summary_tokens_in: transcriptionResult.billing.summaryTokensIn,
                summary_tokens_out: transcriptionResult.billing.summaryTokensOut,
                ai: {
                    provider: transcriptionResult.billing.provider,
                    model_alias: transcriptionResult.billing.modelAlias,
                    model_id: transcriptionResult.billing.modelId,
                    region: transcriptionResult.billing.region ?? "global",
                    workspace_id: context.activeWorkspace.id,
                    route_name: TRANSCRIPTION_ROUTE,
                    capability: "audio",
                    operation: "audio_transcription",
                },
            },
        });

        const processedAt = new Date().toISOString();
        const { error: updateMemoError } = await supabase
            .from("workspace_voice_memos")
            .update({
                transcript: transcriptionResult.transcript,
                summary_json: {
                    summary: transcriptionResult.summary,
                    commitments: transcriptionResult.commitments,
                },
                processed_at: processedAt,
                processing_status: "processed",
                processing_error: null,
                next_retry_at: null,
            })
            .eq("id", memo.id)
            .eq("workspace_id", context.activeWorkspace.id);

        if (updateMemoError) return { error: updateMemoError.message };

        const generatedNote = await createOrUpdateVoiceMemoGeneratedNote({
            supabase,
            input: {
                workspaceId: context.activeWorkspace.id,
                profileId: context.userId,
                memo: {
                    id: memo.id,
                    title: memo.title,
                    duration_seconds: memo.duration_seconds,
                    mime_type: memo.mime_type,
                },
                transcript: transcriptionResult.transcript,
                summary: transcriptionResult.summary,
                commitments: transcriptionResult.commitments,
                processedAt,
            },
        });

        if (generatedNote.error) throw new Error(generatedNote.error);

        await syncSemanticNode({
            workspaceId: context.activeWorkspace.id,
            entityType: "voice_memo",
            entityId: memo.id,
            title: memo.title,
            content: `[Voice Memo Transcript]\n${transcriptionResult.transcript}\n\n[Voice Memo Summary]\n${transcriptionResult.summary}`,
            metadata: {
                workspace_id: context.activeWorkspace.id,
                duration_seconds: memo.duration_seconds,
                mime_type: memo.mime_type,
                processed_at: processedAt,
            },
        });

        let projectId = await resolveScopedProjectId(supabase, context.activeWorkspace.id, targetProjectId?.trim() || memo.target_project_id || null);
        if (!projectId) {
            projectId = await resolveDefaultProjectId(supabase, context.activeWorkspace.id);
        }

        if (projectId && transcriptionResult.commitments.length > 0) {
            await indexExtractedTasks({
                supabase,
                workspaceId: context.activeWorkspace.id,
                userId: context.userId,
                memoId: memo.id,
                projectId,
                commitments: transcriptionResult.commitments,
            });
        }

        revalidatePath("/dashboard/recorder");
        revalidatePath("/dashboard/notes");
        revalidatePath("/dashboard/slas");
        revalidatePath("/dashboard/legibility-hub");
        return { error: null };
    } catch (err) {
        const providerError = normalizeAiProviderError(err, {
            provider: "vertex",
            modelAlias: "audio.transcribe",
            modelId: "chirp_3",
        });
        const message = providerError.code === "quota_rate_limit"
            ? "Voice memo transcription is temporarily rate-limited. Please retry shortly."
            : providerError.code === "auth_config_missing" || providerError.code === "permission_denied" || providerError.code === "model_region_unavailable"
                ? "Voice memo transcription is not available in this workspace right now."
                : "Audio transcription or task injection failed. Please retry shortly.";
        console.error("Audio transcription or task injection failed:", providerError.toJSON());
        if (supabase && scopedMemoId && scopedWorkspaceId) {
            await supabase
                .from("workspace_voice_memos")
                .update({
                    processing_status: "error",
                    processing_error: toSafeVoiceMemoProcessingError(message),
                    next_retry_at: calculateVoiceMemoRetryAt(currentAttemptCount),
                })
                .eq("id", scopedMemoId)
                .eq("workspace_id", scopedWorkspaceId);
        }
        return { error: message };
    }
}

async function processVoiceMemoTranscriptionWithContext(
    memoId: string,
    context: VoiceMemoProcessingContext,
    targetProjectId?: string | null,
): Promise<{ error: string | null }> {
    let scopedMemoId: string | null = null;
    let scopedWorkspaceId: string | null = null;
    let currentAttemptCount = 0;

    try {
        const { data: workspace, error: workspaceError } = await context.supabase
            .from("workspaces")
            .select("id,workspace_tier,is_active")
            .eq("id", context.workspaceId)
            .maybeSingle();

        if (workspaceError) return { error: workspaceError.message };
        if (!workspace?.is_active || workspace.workspace_tier !== "pro") {
            return { error: "AI generation is only available on active Pro workspaces." };
        }

        await assertSufficientAiBalance(context.workspaceId);

        const { data: memo, error: memoError } = await context.supabase
            .from("workspace_voice_memos")
            .select("id,title,storage_path,duration_seconds,mime_type,transcript,processed_at,processing_status,attempt_count,target_project_id,profile_id")
            .eq("id", memoId)
            .eq("workspace_id", context.workspaceId)
            .maybeSingle();

        if (memoError) return { error: memoError.message };
        if (!memo) return { error: "Voice memo not found." };

        if (memo.processed_at && memo.transcript && memo.processing_status === "processed") {
            return { error: null };
        }

        scopedMemoId = memo.id;
        scopedWorkspaceId = context.workspaceId;
        currentAttemptCount = (memo.attempt_count ?? 0) + 1;

        const { error: markProcessingError } = await context.supabase
            .from("workspace_voice_memos")
            .update({
                processing_status: "processing",
                processing_error: null,
                attempt_count: currentAttemptCount,
                last_attempted_at: new Date().toISOString(),
                next_retry_at: null,
            })
            .eq("id", memo.id)
            .eq("workspace_id", context.workspaceId);

        if (markProcessingError) return { error: markProcessingError.message };

        const rate = await checkAiRateLimitPg(context.workspaceId, TRANSCRIPTION_ROUTE, { maxPerWindow: 10 });
        if (!rate.allowed) throw new Error("Voice memo transcription rate limit reached. Please retry shortly.");

        const { data: audioData, error: downloadError } = await context.supabase.storage
            .from(BUCKET)
            .download(memo.storage_path);

        if (downloadError || !audioData) {
            throw new Error(downloadError?.message ?? "Failed to download voice memo audio.");
        }

        const transcriptionResult = await runWithWorkspaceAiConfig(context.workspaceId, async () => transcribeAudio({
            audioBuffer: await audioData.arrayBuffer(),
            mimeType: memo.mime_type || "audio/webm",
            durationSeconds: memo.duration_seconds,
        }));

        const usage = transcriptionResult.billing.unitType === "speech_seconds"
            ? {
                unitType: "speech_seconds" as const,
                model: transcriptionResult.billing.modelId,
                durationSeconds: transcriptionResult.billing.durationSeconds ?? Math.max(1, memo.duration_seconds ?? 60),
            }
            : {
                unitType: "tokens" as const,
                model: transcriptionResult.billing.modelId,
                tokensIn: transcriptionResult.billing.tokensIn ?? Math.max(1, Math.ceil((memo.duration_seconds ?? 60) * 16)),
                tokensOut: transcriptionResult.billing.tokensOut ?? Math.max(1, Math.ceil((transcriptionResult.transcript.length + transcriptionResult.summary.length) / 4)),
            };

        await meterAndCharge({
            workspaceId: context.workspaceId,
            profileId: memo.profile_id ?? context.userId,
            route: TRANSCRIPTION_ROUTE,
            usage,
            metadata: {
                memo_id: memo.id,
                duration_seconds: memo.duration_seconds,
                billable_duration_seconds: usage.unitType === "speech_seconds" ? usage.durationSeconds : undefined,
                fallback_used: transcriptionResult.billing.fallbackUsed,
                speech_model_id: transcriptionResult.billing.speechModelId,
                summary_model_id: transcriptionResult.billing.summaryModelId,
                summary_tokens_in: transcriptionResult.billing.summaryTokensIn,
                summary_tokens_out: transcriptionResult.billing.summaryTokensOut,
                ai: {
                    provider: transcriptionResult.billing.provider,
                    model_alias: transcriptionResult.billing.modelAlias,
                    model_id: transcriptionResult.billing.modelId,
                    region: transcriptionResult.billing.region ?? "global",
                    workspace_id: context.workspaceId,
                    route_name: TRANSCRIPTION_ROUTE,
                    capability: "audio",
                    operation: "audio_transcription",
                },
            },
        });

        const processedAt = new Date().toISOString();
        const { error: updateMemoError } = await context.supabase
            .from("workspace_voice_memos")
            .update({
                transcript: transcriptionResult.transcript,
                summary_json: {
                    summary: transcriptionResult.summary,
                    commitments: transcriptionResult.commitments,
                },
                processed_at: processedAt,
                processing_status: "processed",
                processing_error: null,
                next_retry_at: null,
            })
            .eq("id", memo.id)
            .eq("workspace_id", context.workspaceId);

        if (updateMemoError) return { error: updateMemoError.message };

        const generatedNote = context.isAdminClient
            ? await createOrUpdateVoiceMemoGeneratedNoteWithAdminClient({
                supabase: context.supabase as unknown as RecorderAdminSupabaseClient,
                input: {
                    workspaceId: context.workspaceId,
                    profileId: memo.profile_id ?? context.userId,
                    memo: {
                        id: memo.id,
                        title: memo.title,
                        duration_seconds: memo.duration_seconds,
                        mime_type: memo.mime_type,
                    },
                    transcript: transcriptionResult.transcript,
                    summary: transcriptionResult.summary,
                    commitments: transcriptionResult.commitments,
                    processedAt,
                },
            })
            : await createOrUpdateVoiceMemoGeneratedNote({
                supabase: context.supabase,
                input: {
                    workspaceId: context.workspaceId,
                    profileId: memo.profile_id ?? context.userId,
                    memo: {
                        id: memo.id,
                        title: memo.title,
                        duration_seconds: memo.duration_seconds,
                        mime_type: memo.mime_type,
                    },
                    transcript: transcriptionResult.transcript,
                    summary: transcriptionResult.summary,
                    commitments: transcriptionResult.commitments,
                    processedAt,
                },
            });

        if (generatedNote.error) throw new Error(generatedNote.error);

        const semanticPayload = {
            workspaceId: context.workspaceId,
            entityType: "voice_memo" as const,
            entityId: memo.id,
            title: memo.title,
            content: `[Voice Memo Transcript]\n${transcriptionResult.transcript}\n\n[Voice Memo Summary]\n${transcriptionResult.summary}`,
            metadata: {
                workspace_id: context.workspaceId,
                duration_seconds: memo.duration_seconds,
                mime_type: memo.mime_type,
                processed_at: processedAt,
            },
        };

        if (context.isAdminClient) {
            await syncSemanticNodeWithClient({ supabase: context.supabase as unknown as RecorderAdminSupabaseClient, ...semanticPayload });
        } else {
            await syncSemanticNode(semanticPayload);
        }

        let projectId = await resolveScopedProjectId(context.supabase, context.workspaceId, targetProjectId?.trim() || memo.target_project_id || null);
        if (!projectId) {
            projectId = await resolveDefaultProjectId(context.supabase, context.workspaceId);
        }

        if (projectId && transcriptionResult.commitments.length > 0) {
            await indexExtractedTasks({
                supabase: context.supabase,
                workspaceId: context.workspaceId,
                userId: memo.profile_id ?? context.userId,
                memoId: memo.id,
                projectId,
                commitments: transcriptionResult.commitments,
                useAdminClient: context.isAdminClient,
            });
        }

        return { error: null };
    } catch (err) {
        const providerError = normalizeAiProviderError(err, {
            provider: "vertex",
            modelAlias: "audio.transcribe",
            modelId: "chirp_3",
        });
        const message = providerError.code === "quota_rate_limit"
            ? "Voice memo transcription is temporarily rate-limited. Please retry shortly."
            : providerError.code === "auth_config_missing" || providerError.code === "permission_denied" || providerError.code === "model_region_unavailable"
                ? "Voice memo transcription is not available in this workspace right now."
                : "Audio transcription or task injection failed. Please retry shortly.";
        console.error("Cron voice memo processing failed:", providerError.toJSON());
        if (scopedMemoId && scopedWorkspaceId) {
            await context.supabase
                .from("workspace_voice_memos")
                .update({
                    processing_status: "error",
                    processing_error: toSafeVoiceMemoProcessingError(message),
                    next_retry_at: calculateVoiceMemoRetryAt(currentAttemptCount),
                })
                .eq("id", scopedMemoId)
                .eq("workspace_id", scopedWorkspaceId);
        }
        return { error: message };
    }
}

export async function processPendingVoiceMemos(limit = 3): Promise<{ processed: number; failed: number; error: string | null }> {
    try {
        const context = await assertWorkspaceAiEnabled();
        await assertWorkspaceAdminOrManager();
        const supabase = await createClient();
        const now = new Date().toISOString();
        const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));

        const { data: memos, error } = await supabase
            .from("workspace_voice_memos")
            .select("id,processing_status,next_retry_at")
            .eq("workspace_id", context.activeWorkspace.id)
            .in("processing_status", ["pending", "error"])
            .order("created_at", { ascending: true })
            .limit(safeLimit * 2);

        if (error) return { processed: 0, failed: 0, error: error.message };

        let processed = 0;
        let failed = 0;
        for (const memo of (memos ?? []).filter((row) => row.processing_status === "pending" || !row.next_retry_at || row.next_retry_at <= now).slice(0, safeLimit)) {
            const result = await processVoiceMemoTranscription(memo.id);
            if (result.error) failed += 1;
            else processed += 1;
        }

        return { processed, failed, error: null };
    } catch (err) {
        return { processed: 0, failed: 0, error: err instanceof Error ? err.message : "Failed to process pending voice memos." };
    }
}

export async function processPendingVoiceMemosForCron(limit = 3): Promise<{
    attempted: number;
    processed: number;
    failed: number;
    skipped: number;
    error: string | null;
}> {
    try {
        const supabase = createAdminClient() as unknown as RecorderSupabaseClient;
        const now = new Date().toISOString();
        const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));

        const { data: memos, error } = await supabase
            .from("workspace_voice_memos")
            .select("id,workspace_id,profile_id,processing_status,next_retry_at")
            .in("processing_status", ["pending", "error"])
            .order("created_at", { ascending: true })
            .limit(safeLimit * 2);

        if (error) return { attempted: 0, processed: 0, failed: 0, skipped: 0, error: error.message };

        const dueMemos = (memos ?? [])
            .filter((row) => row.processing_status === "pending" || !row.next_retry_at || row.next_retry_at <= now)
            .slice(0, safeLimit);

        let processed = 0;
        let failed = 0;
        for (const memo of dueMemos) {
            const result = await processVoiceMemoTranscriptionWithContext(memo.id, {
                workspaceId: memo.workspace_id,
                userId: memo.profile_id,
                supabase,
                isAdminClient: true,
            });
            if (result.error) failed += 1;
            else processed += 1;
        }

        return {
            attempted: dueMemos.length,
            processed,
            failed,
            skipped: Math.max(0, (memos?.length ?? 0) - dueMemos.length),
            error: null,
        };
    } catch (err) {
        return {
            attempted: 0,
            processed: 0,
            failed: 0,
            skipped: 0,
            error: err instanceof Error ? err.message : "Failed to process pending voice memos.",
        };
    }
}

export async function retryVoiceMemoProcessing(memoId: string): Promise<{ error: string | null }> {
    const ctx = await currentUserAndWorkspace();
    if ("error" in ctx) return { error: ctx.error };

    const supabase = await createClient();
    const { data: memo, error } = await supabase
        .from("workspace_voice_memos")
        .select("id")
        .eq("id", memoId)
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.userId)
        .maybeSingle();

    if (error) return { error: error.message };
    if (!memo) return { error: "Voice memo not found." };

    return processVoiceMemoTranscription(memo.id);
}

export async function uploadVoiceMemo(formData: FormData): Promise<{ error: string | null }> {
    const ctx = await currentUserAndWorkspace();
    if ("error" in ctx) return { error: ctx.error };

    const file = formData.get("audio") as File | null;
    const title = (formData.get("title") as string | null)?.trim() || "Voice memo";
    const durationRaw = Number(formData.get("duration_seconds") ?? 0);
    const duration = Number.isFinite(durationRaw) ? Math.max(0, Math.min(3600, Math.round(durationRaw))) : 0;
    const targetProjectId = formData.get("project_id") as string | null;

    if (!file || file.size === 0) return { error: "No audio data received." };
    if (file.size > MAX_BYTES) return { error: `Audio exceeds ${MAX_BYTES / 1024 / 1024}MB cap.` };
    const mime = file.type || "audio/webm";
    if (!mime.startsWith("audio/")) return { error: "Uploaded file is not audio." };

    const memoId = randomUUID();
    const extension = mime === "audio/webm" ? "webm" : mime === "audio/ogg" ? "ogg" : "bin";
    const storagePath = `${ctx.workspaceId}/${ctx.userId}/${memoId}.${extension}`;

    const supabase = await createClient();
    const scopedTargetProjectId = await resolveScopedProjectId(supabase, ctx.workspaceId, targetProjectId);
    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: mime, upsert: false });
    if (uploadError) return { error: uploadError.message };

    const { error: insertError } = await supabase
        .from("workspace_voice_memos")
        .insert({
            id: memoId,
            workspace_id: ctx.workspaceId,
            profile_id: ctx.userId,
            title: title.slice(0, 200),
            storage_path: storagePath,
            duration_seconds: duration,
            mime_type: mime,
            processing_status: "pending",
            processing_error: null,
            attempt_count: 0,
            target_project_id: scopedTargetProjectId,
        });
    if (insertError) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        return { error: insertError.message };
    }

    revalidatePath("/dashboard/recorder");
    return { error: null };
}

export async function deleteVoiceMemo(id: string): Promise<{ error: string | null }> {
    const ctx = await currentUserAndWorkspace();
    if ("error" in ctx) return { error: ctx.error };

    const supabase = await createClient();
    const { data: row, error: fetchError } = await supabase
        .from("workspace_voice_memos")
        .select("storage_path")
        .eq("id", id)
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.userId)
        .maybeSingle();
    if (fetchError) return { error: fetchError.message };
    if (!row) return { error: "Voice memo not found." };

    await supabase.storage.from(BUCKET).remove([(row as { storage_path: string }).storage_path]);
    const { error: deleteError } = await supabase
        .from("workspace_voice_memos")
        .delete()
        .eq("id", id)
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.userId);
    if (deleteError) return { error: deleteError.message };

    revalidatePath("/dashboard/recorder");
    return { error: null };
}
