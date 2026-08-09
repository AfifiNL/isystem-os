import { hashEmailForAnalytics } from "@/features/analytics/privacy";
import type { OutreachContactRow, OutreachLawfulBasis, OutreachMessageRow, OutreachWorkspaceSettingsRow } from "@/features/outreach/types";

const DEFAULT_ALLOWED_BASES: OutreachLawfulBasis[] = [
    "explicit_consent",
    "existing_customer",
    "legitimate_interest_assessment",
    "manual_warranty",
];

export function normalizeOutreachEmail(value: string | null | undefined) {
    const normalized = value?.trim().toLowerCase() ?? "";
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function outreachEmailHash(value: string | null | undefined) {
    const normalized = normalizeOutreachEmail(value);
    return normalized ? hashEmailForAnalytics(normalized) : null;
}

export function domainFromEmail(value: string | null | undefined) {
    const normalized = normalizeOutreachEmail(value);
    return normalized ? normalized.split("@")[1] ?? null : null;
}

export function buildOutreachUnsubscribeUrl(messageId: string, token: string) {
    const base = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!base) {
        throw new Error("NEXT_PUBLIC_SITE_URL is required to build outreach unsubscribe links.");
    }
    const url = new URL("/outreach/unsubscribe", base);
    if (!/^https?:$/.test(url.protocol)) {
        throw new Error("NEXT_PUBLIC_SITE_URL must use http or https.");
    }
    url.searchParams.set("message", messageId);
    url.searchParams.set("token", token);
    return url.toString();
}

export function buildListUnsubscribeHeaders(unsubscribeUrl: string, replyTo: string | null | undefined) {
    const mailto = replyTo?.trim() ? `mailto:${replyTo.trim()}?subject=unsubscribe` : null;
    return {
        "List-Unsubscribe": [mailto, `<${unsubscribeUrl}>`].filter(Boolean).join(", "),
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
}

export type OutreachSendEligibility = {
    allowed: boolean;
    reason: string;
};

export function evaluateContactEligibility(input: {
    contact: Pick<OutreachContactRow, "email" | "lawful_basis" | "review_status" | "suppressed_at">;
    settings?: Pick<OutreachWorkspaceSettingsRow, "allowed_lawful_bases"> | null;
}): OutreachSendEligibility {
    const email = normalizeOutreachEmail(input.contact.email);
    if (!email) return { allowed: false, reason: "Contact has no valid email address." };
    if (input.contact.suppressed_at) return { allowed: false, reason: "Contact is suppressed." };
    if (input.contact.review_status !== "approved") return { allowed: false, reason: "Contact has not been approved by an operator." };

    const allowedBases = input.settings?.allowed_lawful_bases?.length
        ? input.settings.allowed_lawful_bases
        : DEFAULT_ALLOWED_BASES;
    if (!allowedBases.includes(input.contact.lawful_basis)) {
        return { allowed: false, reason: `Lawful basis ${input.contact.lawful_basis} is not eligible for outreach.` };
    }

    return { allowed: true, reason: "Contact is eligible." };
}

export function evaluateMessageEligibility(input: {
    message: Pick<OutreachMessageRow, "status" | "approved_at" | "body_html" | "subject">;
    requireHumanApproval: boolean;
}): OutreachSendEligibility {
    if (!["approved", "scheduled", "sending"].includes(input.message.status)) {
        return { allowed: false, reason: `Message status ${input.message.status} cannot be sent.` };
    }
    if (input.requireHumanApproval && !input.message.approved_at) {
        return { allowed: false, reason: "Human approval is required before dispatch." };
    }
    if (!input.message.subject.trim() || !input.message.body_html.trim()) {
        return { allowed: false, reason: "Message subject and HTML body are required." };
    }
    return { allowed: true, reason: "Message is eligible." };
}
