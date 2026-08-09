import { sha256Hex } from "@/features/legal-vault/lib/hashing";
import type { LegalAgreement } from "@/features/legal-vault/types";

export interface EvidenceSignatureEvent {
    id: string;
    event: string;
    actorEmail: string | null;
    actorIp: string | null;
    occurredAt: string;
}

export interface EvidenceBundlePayload {
    agreement: Pick<
        LegalAgreement,
        "id" | "title" | "partyName" | "partyEmail" | "status" | "signedAt" | "signedSha256" | "createdAt" | "updatedAt"
    >;
    signatureLevel: "eidas_ses" | "eidas_ses_otp";
    authMethod: string;
    generatedAt: string;
    renderedHtml: string;
    events: EvidenceSignatureEvent[];
    manifest: {
        renderedHtmlSha256: string;
        eventLogSha256: string;
        signedPayloadSha256: string | null;
    };
}

export function buildEvidenceBundlePayload(args: {
    agreement: LegalAgreement;
    renderedHtml: string;
    events: EvidenceSignatureEvent[];
    authMethod: string;
    generatedAt?: string;
}): EvidenceBundlePayload {
    const generatedAt = args.generatedAt ?? new Date().toISOString();
    return {
        agreement: {
            id: args.agreement.id,
            title: args.agreement.title,
            partyName: args.agreement.partyName,
            partyEmail: args.agreement.partyEmail,
            status: args.agreement.status,
            signedAt: args.agreement.signedAt,
            signedSha256: args.agreement.signedSha256,
            createdAt: args.agreement.createdAt,
            updatedAt: args.agreement.updatedAt,
        },
        signatureLevel: args.authMethod === "email_otp" ? "eidas_ses_otp" : "eidas_ses",
        authMethod: args.authMethod,
        generatedAt,
        renderedHtml: args.renderedHtml,
        events: args.events,
        manifest: {
            renderedHtmlSha256: sha256Hex(args.renderedHtml),
            eventLogSha256: sha256Hex(JSON.stringify(args.events)),
            signedPayloadSha256: args.agreement.signedSha256,
        },
    };
}

export function evidenceBundleSha256(payload: EvidenceBundlePayload): string {
    return sha256Hex(JSON.stringify(payload));
}
