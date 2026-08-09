"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/shared/lib/supabase/server";
import { assertLegalVaultAccess } from "@/features/legal-vault/lib/access";
import { getLegalVaultServiceClient } from "@/features/legal-vault/lib/service-client";
import { sha256Hex } from "@/features/legal-vault/lib/hashing";
import { sendEmail } from "@/shared/lib/resend/send-email";
import { recordLegalAuditEvent } from "@/features/legal-vault/lib/audit";
import { getLegalAgreement } from "@/features/legal-vault/actions/agreements";
import { recordLegalAgreementBusinessEvent } from "@/features/business-spine/recorders";
import {
    buildEvidenceBundlePayload,
    evidenceBundleSha256,
    type EvidenceSignatureEvent,
} from "@/features/legal-vault/lib/evidence-bundle";
import type {
    ActionResult,
    LegalAgreement,
    LegalSignatureEventKind,
} from "@/features/legal-vault/types";

interface SignRequestInput {
    agreementId: string;
}

export async function sendAgreementForSignature(
    input: SignRequestInput,
): Promise<ActionResult<{ id: string; sentTo: string }>> {
    try {
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();

        const { data: row, error } = await supabase
            .from("legal_agreements")
            .select("*")
            .eq("id", input.agreementId)
            .eq("workspace_id", activeWorkspace.id)
            .maybeSingle();
        if (error) return { success: false, error: error.message };
        if (!row) return { success: false, error: "Agreement not found." };
        if (row.status !== "draft" && row.status !== "viewed") {
            return { success: false, error: `Agreement is ${row.status}; only draft/viewed agreements can be (re)sent.` };
        }

        const signUrl = buildSignUrl(row.public_token);
        const subject = `Action required: please review and sign — ${row.title}`;
        const html = renderSignEmail({
            title: row.title,
            partyName: row.party_name,
            signUrl,
            workspaceName: activeWorkspace.name,
        });

        let emailId: string | null = null;
        try {
            const result = await sendEmail({
                from: defaultFromEmail(),
                to: row.party_email,
                subject,
                html,
                replyTo: defaultReplyTo(),
                idempotencyKey: `agreement-${row.id}-${row.public_token.slice(0, 8)}`,
            });
            emailId = result.id;
        } catch (sendError: unknown) {
            return { success: false, error: sendError instanceof Error ? sendError.message : "Email failed." };
        }

        await supabase
            .from("legal_agreements")
            .update({
                status: "sent",
                last_sent_at: new Date().toISOString(),
                public_token_expires_at: daysFromNow(30),
                public_token_revoked_at: null,
            })
            .eq("id", row.id);

        await recordSignatureEvent({
            workspaceId: activeWorkspace.id,
            agreementId: row.id,
            event: "sent",
            actorEmail: null,
            metadata: { sent_by: userId, email_id: emailId, recipient: row.party_email },
        });

        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "agreement.sent_for_signature",
            resourceType: "agreement",
            resourceId: row.id,
            metadata: { emailId, recipient: row.party_email },
        });

        revalidatePath(`/dashboard/legal-vault/agreements/${row.id}`);
        return { success: true, data: { id: row.id, sentTo: row.party_email } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

// Server-side fetch of an agreement by its public token. Skips workspace
// auth — designed for the unauthenticated /sign/[token] page. Returns only
// the fields the signer needs to see.
export async function getAgreementByPublicToken(
    token: string,
): Promise<ActionResult<PublicAgreementView>> {
    try {
        if (!/^[a-f0-9]{32,128}$/.test(token)) {
            return { success: false, error: "Invalid signing token." };
        }
        const service = getLegalVaultServiceClient();
        if (!service) return { success: false, error: "Server not configured." };

        const { data, error } = await service
            .from("legal_agreements")
            .select("id, workspace_id, status, title, party_name, party_email, payload, signed_at, signed_sha256, public_token, expires_at")
            .eq("public_token", token)
            .maybeSingle();

        if (error || !data) {
            return { success: false, error: "Agreement not found." };
        }

        return {
            success: true,
            data: {
                id: data.id as string,
                workspaceId: data.workspace_id as string,
                status: data.status as LegalAgreement["status"],
                title: data.title as string,
                partyName: data.party_name as string,
                partyEmail: data.party_email as string,
                renderedHtml:
                    typeof (data.payload as Record<string, unknown>)?.rendered_html === "string"
                        ? ((data.payload as Record<string, unknown>).rendered_html as string)
                        : null,
                signedAt: (data.signed_at as string | null) ?? null,
                signedSha256: (data.signed_sha256 as string | null) ?? null,
                expiresAt: (data.expires_at as string | null) ?? null,
            },
        };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export interface PublicAgreementView {
    id: string;
    workspaceId: string;
    status: LegalAgreement["status"];
    title: string;
    partyName: string;
    partyEmail: string;
    renderedHtml: string | null;
    signedAt: string | null;
    signedSha256: string | null;
    expiresAt: string | null;
}

// Called from the public sign page when a signer hits the URL — produces a
// "viewed" event the first time and updates the agreement status.
export async function recordAgreementView(token: string): Promise<ActionResult<{ id: string }>> {
    try {
        const result = await getAgreementByPublicToken(token);
        if (!result.success) return result;
        if (result.data.status !== "sent") {
            // Already viewed/signed/void — don't bump again.
            return { success: true, data: { id: result.data.id } };
        }

        const service = getLegalVaultServiceClient();
        if (!service) return { success: false, error: "Server not configured." };

        await service
            .from("legal_agreements")
            .update({ status: "viewed" })
            .eq("id", result.data.id);

        const requestContext = await captureRequestContext();
        await recordSignatureEvent({
            workspaceId: result.data.workspaceId,
            agreementId: result.data.id,
            event: "viewed",
            actorEmail: result.data.partyEmail,
            actorIp: requestContext.ip,
            actorUserAgent: requestContext.userAgent,
        });

        await recordLegalAuditEvent({
            workspaceId: result.data.workspaceId,
            actorEmail: result.data.partyEmail,
            event: "agreement.viewed_by_counterparty",
            resourceType: "agreement",
            resourceId: result.data.id,
            actorIp: requestContext.ip,
            actorUserAgent: requestContext.userAgent,
        });

        return { success: true, data: { id: result.data.id } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

interface SignInput {
    token: string;
    signerName: string;
    signerEmail: string;
    acceptedAt: string;
    typedSignature: string;
}

export async function signAgreement(input: SignInput): Promise<ActionResult<{ id: string }>> {
    try {
        if (!input.signerName || !input.signerEmail || !input.typedSignature) {
            return { success: false, error: "Name, email, and typed signature are required." };
        }
        const result = await getAgreementByPublicToken(input.token);
        if (!result.success) return result;
        const agreement = result.data;

        if (agreement.status === "signed") {
            return { success: false, error: "Agreement already signed." };
        }
        if (agreement.status === "void" || agreement.status === "expired") {
            return { success: false, error: `Agreement is ${agreement.status} and cannot be signed.` };
        }
        if (agreement.partyEmail.toLowerCase() !== input.signerEmail.toLowerCase()) {
            return { success: false, error: "Email does not match the intended counterparty." };
        }
        if (agreement.expiresAt && agreement.expiresAt < new Date().toISOString().slice(0, 10)) {
            return { success: false, error: "Agreement has expired and cannot be signed." };
        }

        const tokenState = await getSigningTokenState(input.token);
        if (!tokenState.success) return tokenState;
        if (tokenState.data.revokedAt) {
            return { success: false, error: "Signing link has been revoked." };
        }
        if (tokenState.data.expiresAt && new Date(tokenState.data.expiresAt).getTime() < Date.now()) {
            return { success: false, error: "Signing link has expired. Request a fresh signing link." };
        }

        const requestContext = await captureRequestContext();
        const payload = JSON.stringify({
            agreementId: agreement.id,
            renderedHtml: agreement.renderedHtml ?? "",
            signerName: input.signerName,
            signerEmail: input.signerEmail,
            typedSignature: input.typedSignature,
            acceptedAt: input.acceptedAt,
            ip: requestContext.ip,
            userAgent: requestContext.userAgent,
        });
        const signedSha256 = sha256Hex(payload);

        const service = getLegalVaultServiceClient();
        if (!service) return { success: false, error: "Server not configured." };

        const { error } = await service
            .from("legal_agreements")
            .update({
                status: "signed",
                signed_at: input.acceptedAt,
                signed_sha256: signedSha256,
            })
            .eq("id", agreement.id)
            .eq("public_token", input.token);

        if (error) return { success: false, error: error.message };

        await recordSignatureEvent({
            workspaceId: agreement.workspaceId,
            agreementId: agreement.id,
            event: "signed",
            actorEmail: input.signerEmail,
            actorIp: requestContext.ip,
            actorUserAgent: requestContext.userAgent,
            payloadSha256: signedSha256,
            metadata: { signerName: input.signerName, typedSignature: input.typedSignature },
        });

        await recordLegalAuditEvent({
            workspaceId: agreement.workspaceId,
            actorEmail: input.signerEmail,
            event: "agreement.signed",
            resourceType: "agreement",
            resourceId: agreement.id,
            actorIp: requestContext.ip,
            actorUserAgent: requestContext.userAgent,
            metadata: { payloadSha256: signedSha256, authMethod: "email_link_ses" },
        });

        await recordLegalAgreementBusinessEvent({
            supabase: service,
            workspaceId: agreement.workspaceId,
            agreementId: agreement.id,
            eventType: "signed",
            customer: {
                name: input.signerName,
                email: input.signerEmail,
            },
            title: agreement.title,
            payload: { payloadSha256: signedSha256, authMethod: "email_link_ses" },
        });

        await generateEvidenceBundleForAgreement(agreement.id, "email_link_ses");

        revalidatePath(`/dashboard/legal-vault/agreements/${agreement.id}`);
        return { success: true, data: { id: agreement.id } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function getAgreementEvidenceBundle(
    agreementId: string,
): Promise<ActionResult<{ bundle: Record<string, unknown>; sha256: string; generatedAt: string }>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const service = getLegalVaultServiceClient();
        if (!service) return { success: false, error: "Server not configured." };

        const { data, error } = await service
            .from("legal_evidence_bundles")
            .select("bundle_json, sha256, generated_at")
            .eq("agreement_id", agreementId)
            .eq("workspace_id", activeWorkspace.id)
            .order("generated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !data) {
            return { success: false, error: error?.message ?? "Evidence bundle not found." };
        }

        return {
            success: true,
            data: {
                bundle: (data.bundle_json as Record<string, unknown>) ?? {},
                sha256: data.sha256 as string,
                generatedAt: data.generated_at as string,
            },
        };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function listAgreementSignatureEvents(
    agreementId: string,
): Promise<ActionResult<Array<{
    id: string;
    event: LegalSignatureEventKind;
    actorEmail: string | null;
    actorIp: string | null;
    occurredAt: string;
}>>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("legal_signature_events")
            .select("id, event, actor_email, actor_ip, occurred_at, agreement_id, workspace_id")
            .eq("agreement_id", agreementId)
            .eq("workspace_id", activeWorkspace.id)
            .order("occurred_at", { ascending: false });
        if (error) return { success: false, error: error.message };
        return {
            success: true,
            data: (data ?? []).map((row) => ({
                id: row.id as string,
                event: row.event as LegalSignatureEventKind,
                actorEmail: (row.actor_email as string | null) ?? null,
                actorIp: (row.actor_ip as string | null) ?? null,
                occurredAt: row.occurred_at as string,
            })),
        };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SignatureEventWrite {
    workspaceId: string;
    agreementId: string;
    event: LegalSignatureEventKind;
    actorEmail?: string | null;
    actorIp?: string | null;
    actorUserAgent?: string | null;
    payloadSha256?: string;
    metadata?: Record<string, unknown>;
}

async function recordSignatureEvent(write: SignatureEventWrite): Promise<void> {
    const service = getLegalVaultServiceClient();
    if (!service) return;
    const { data: previous } = await service
        .from("legal_signature_events")
        .select("sequence_number, event_hash")
        .eq("agreement_id", write.agreementId)
        .order("sequence_number", { ascending: false })
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    const sequenceNumber = Number(previous?.sequence_number ?? 0) + 1;
    const previousEventHash = typeof previous?.event_hash === "string" ? previous.event_hash : null;
    const occurredAt = new Date().toISOString();
    const eventHash = sha256Hex(JSON.stringify({ ...write, sequenceNumber, previousEventHash, occurredAt }));
    await service.from("legal_signature_events").insert({
        workspace_id: write.workspaceId,
        agreement_id: write.agreementId,
        event: write.event,
        actor_email: write.actorEmail ?? null,
        actor_ip: write.actorIp ?? null,
        actor_user_agent: write.actorUserAgent ?? null,
        payload_sha256: write.payloadSha256 ?? null,
        metadata: write.metadata ?? {},
        sequence_number: sequenceNumber,
        auth_method: typeof write.metadata?.authMethod === "string" ? write.metadata.authMethod : null,
        auth_provider: typeof write.metadata?.authProvider === "string" ? write.metadata.authProvider : null,
        auth_reference: typeof write.metadata?.authReference === "string" ? write.metadata.authReference : null,
        previous_event_hash: previousEventHash,
        event_hash: eventHash,
        occurred_at: occurredAt,
    });
}

async function getSigningTokenState(token: string): Promise<ActionResult<{ expiresAt: string | null; revokedAt: string | null }>> {
    const service = getLegalVaultServiceClient();
    if (!service) return { success: false, error: "Server not configured." };
    const { data, error } = await service
        .from("legal_agreements")
        .select("public_token_expires_at, public_token_revoked_at")
        .eq("public_token", token)
        .maybeSingle();
    if (error || !data) return { success: false, error: error?.message ?? "Signing link not found." };
    return {
        success: true,
        data: {
            expiresAt: (data.public_token_expires_at as string | null) ?? null,
            revokedAt: (data.public_token_revoked_at as string | null) ?? null,
        },
    };
}

async function generateEvidenceBundleForAgreement(agreementId: string, authMethod: string): Promise<void> {
    const agreementResult = await getLegalAgreement(agreementId);
    if (!agreementResult.success) return;
    const agreement = agreementResult.data;
    const renderedHtml = typeof agreement.payload.rendered_html === "string" ? agreement.payload.rendered_html : "";
    const eventsResult = await listAgreementSignatureEvents(agreementId);
    if (!eventsResult.success) return;

    const events: EvidenceSignatureEvent[] = eventsResult.data.map((event) => ({
        id: event.id,
        event: event.event,
        actorEmail: event.actorEmail,
        actorIp: event.actorIp,
        occurredAt: event.occurredAt,
    }));
    const bundle = buildEvidenceBundlePayload({ agreement, renderedHtml, events, authMethod });
    const sha256 = evidenceBundleSha256(bundle);
    const service = getLegalVaultServiceClient();
    if (!service) return;
    const { data } = await service
        .from("legal_evidence_bundles")
        .insert({
            workspace_id: agreement.workspaceId,
            agreement_id: agreement.id,
            document_id: agreement.documentId,
            bundle_json: bundle,
            sha256,
            signature_level: bundle.signatureLevel,
            timestamp_provider: "local_server_clock",
            timestamp_token: bundle.generatedAt,
        })
        .select("id")
        .single();
    if (data?.id) {
        await service
            .from("legal_agreements")
            .update({ evidence_bundle_id: data.id, signature_level: bundle.signatureLevel })
            .eq("id", agreement.id);
    }
}

function daysFromNow(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString();
}

async function captureRequestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
    try {
        const h = await headers();
        const forwarded = h.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0]?.trim() ?? null : h.get("x-real-ip");
        const userAgent = h.get("user-agent");
        return { ip: ip || null, userAgent: userAgent || null };
    } catch {
        return { ip: null, userAgent: null };
    }
}

function buildSignUrl(publicToken: string): string {
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
    return `${base}/sign/${publicToken}`;
}

function defaultFromEmail(): string {
    return (
        process.env.LEGAL_FROM_EMAIL?.trim() ||
        process.env.BOOKING_FROM_EMAIL?.trim() ||
        process.env.NEWSLETTER_FROM_EMAIL?.trim() ||
        "Legal <noreply@example.invalid>"
    );
}

function defaultReplyTo(): string | undefined {
    return (
        process.env.LEGAL_REPLY_TO_EMAIL?.trim() ||
        process.env.NEWSLETTER_REPLY_TO_EMAIL?.trim() ||
        undefined
    );
}

function renderSignEmail(args: {
    title: string;
    partyName: string;
    signUrl: string;
    workspaceName: string;
}): string {
    return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin:0 0 12px">${escape(args.title)}</h2>
  <p>Hi ${escape(args.partyName)},</p>
  <p>${escape(args.workspaceName)} has prepared an agreement for your review.
     Please open the link below to read the document and add your electronic
     signature.</p>
  <p style="margin:24px 0"><a href="${args.signUrl}"
     style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">
     Review &amp; sign</a></p>
  <p style="color:#555;font-size:13px">Or paste this URL into your browser:<br />
     <a href="${args.signUrl}">${args.signUrl}</a></p>
  <p style="color:#888;font-size:12px;margin-top:32px">
    Sent by ${escape(args.workspaceName)}. This signing link is unique to you;
    please do not forward it.</p>
</body></html>`;
}

function escape(value: string): string {
    return value.replace(/[&<>"']/g, (ch) => {
        switch (ch) {
            case "&": return "&amp;";
            case "<": return "&lt;";
            case ">": return "&gt;";
            case '"': return "&quot;";
            case "'": return "&#39;";
            default: return ch;
        }
    });
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unexpected error.";
}
