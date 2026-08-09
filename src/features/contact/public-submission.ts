import { createHash } from "node:crypto";

type ContactLocale = "en" | "nl" | "ar";
type ContactJson = string | number | boolean | null | { [key: string]: ContactJson | undefined } | ContactJson[];

export type ContactWorkspace = {
    id: string;
    name: string;
    templateId: string;
};

export type ContactWorkspaceResolutionCode = "invalid_host" | "workspace_not_found" | "template_mismatch";

export class ContactWorkspaceResolutionError extends Error {
    constructor(public readonly code: ContactWorkspaceResolutionCode, message: string) {
        super(message);
        this.name = "ContactWorkspaceResolutionError";
    }
}

export function normalizeContactRequestHost(value: string | null | undefined): string | null {
    const candidate = value?.split(",", 1)[0]?.trim();
    if (!candidate) return null;

    try {
        const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return url.hostname
            .toLowerCase()
            .replace(/\.$/, "")
            .replace(/^www\./, "") || null;
    } catch {
        return null;
    }
}

export async function resolveContactWorkspace(input: {
    requestHost: string | null | undefined;
    templateId: string;
    lookupByDomain: (domain: string) => Promise<ContactWorkspace | null>;
}): Promise<ContactWorkspace> {
    const domain = normalizeContactRequestHost(input.requestHost);
    if (!domain) {
        throw new ContactWorkspaceResolutionError("invalid_host", "Contact request host is invalid.");
    }

    const workspace = await input.lookupByDomain(domain);
    if (!workspace) {
        throw new ContactWorkspaceResolutionError("workspace_not_found", "No active workspace matches the contact request host.");
    }
    if (workspace.templateId !== input.templateId) {
        throw new ContactWorkspaceResolutionError("template_mismatch", "Contact form template does not match the request workspace.");
    }
    return workspace;
}

export function contactEmailIdempotencyKeys(submissionId: string, managerEmail: string) {
    const prefix = `contact-submission:${submissionId}`;
    return {
        customer: `${prefix}:customer`,
        manager: `${prefix}:manager:${managerEmail.trim().toLowerCase()}`,
    };
}

type StableContactInput = {
    name: string;
    email: string;
    company: string;
    phone: string;
    requestType: string;
    timeline: string;
    challenge: string;
    locale: ContactLocale;
    marketingConsent: boolean;
};

function normalizedStableContactInput(input: StableContactInput) {
    return {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        company: input.company.trim(),
        phone: input.phone.trim(),
        requestType: input.requestType.trim(),
        timeline: input.timeline.trim(),
        challenge: input.challenge.trim(),
        locale: input.locale,
        marketingConsent: input.marketingConsent,
    };
}

export function contactSubmissionFingerprint(input: StableContactInput): string {
    return createHash("sha256")
        .update(JSON.stringify(normalizedStableContactInput(input)), "utf8")
        .digest("hex");
}

const CONTACT_REPLAY_CONFLICT_MESSAGES = [
    "Contact submission ID was already used with a different fingerprint.",
    "Contact submission ID was already used with a different inquiry payload.",
    "Transactional email idempotency key was already used with a different payload.",
] as const;

export function isContactSubmissionReplayConflict(error: {
    code?: string | null;
    message?: string | null;
}): boolean {
    return error.code === "23514"
        && CONTACT_REPLAY_CONFLICT_MESSAGES.some((message) => error.message?.includes(message));
}

export function getContactDeliveryDisposition(delivery: {
    requested: number;
    delivered: number;
} | null): { deliveryDegraded: boolean; status: 200 | 202 } {
    const deliveryDegraded = !delivery || delivery.delivered !== delivery.requested;
    return { deliveryDegraded, status: deliveryDegraded ? 202 : 200 };
}

type ContactEmailContent = {
    eventType: string;
    locale: ContactLocale;
    replyToEmail?: string | null;
    subject: string;
    html: string;
};

type AtomicContactSubmissionInput = StableContactInput & {
    workspaceId: string;
    submissionId: string;
    metadata: Record<string, ContactJson | undefined>;
    fromEmail: string;
    customer: ContactEmailContent;
    managers: ReadonlyArray<ContactEmailContent & { email: string }>;
};

export function buildAtomicContactSubmission(input: AtomicContactSubmissionInput) {
    const stable = normalizedStableContactInput(input);
    const keys = contactEmailIdempotencyKeys(input.submissionId, stable.email);
    const commonJob = {
        workspace_id: input.workspaceId,
        aggregate_type: "contact_inquiry" as const,
        from_email: input.fromEmail.trim(),
        payload_json: {},
    };
    const emailJobs = [
        {
            ...commonJob,
            event_type: input.customer.eventType,
            recipient_role: "customer" as const,
            recipient_email: stable.email,
            locale: input.customer.locale,
            reply_to_email: input.customer.replyToEmail?.trim() || null,
            subject: input.customer.subject,
            html_body: input.customer.html,
            idempotency_key: keys.customer,
        },
        ...input.managers.map((manager) => {
            const managerEmail = manager.email.trim().toLowerCase();
            return {
                ...commonJob,
                event_type: manager.eventType,
                recipient_role: "manager" as const,
                recipient_email: managerEmail,
                locale: manager.locale,
                reply_to_email: manager.replyToEmail?.trim() || null,
                subject: manager.subject,
                html_body: manager.html,
                idempotency_key: contactEmailIdempotencyKeys(input.submissionId, managerEmail).manager,
            };
        }),
    ];

    return {
        fingerprint: contactSubmissionFingerprint(stable),
        inquiry: {
            workspace_id: input.workspaceId,
            submission_id: input.submissionId,
            customer_name: stable.name,
            customer_email: stable.email,
            company: stable.company || null,
            request_type: stable.requestType || null,
            timeline: stable.timeline || null,
            challenge: stable.challenge || null,
            locale: stable.locale,
            marketing_consent: stable.marketingConsent,
            metadata: {
                ...input.metadata,
                phone: stable.phone || null,
            },
        },
        emailJobs,
        emailJobKeys: emailJobs.map((job) => job.idempotency_key),
    };
}
