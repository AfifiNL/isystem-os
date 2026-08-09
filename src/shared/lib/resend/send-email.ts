interface SendEmailParams {
    from: string;
    to: string | string[];
    subject: string;
    html: string;
    replyTo?: string;
    /**
     * Custom RFC 822 headers to attach to the message. Used for List-Unsubscribe /
     * List-Unsubscribe-Post so Gmail and Yahoo bulk sender requirements
     * (effective Feb 2024) are satisfied on every bulk send.
     */
    headers?: Record<string, string>;
    /**
     * Idempotency key forwarded to Resend so a retried request from the
     * dispatcher does not double-send the same recipient on a function
     * timeout retry. Resend deduplicates for 24h on identical keys.
     */
    idempotencyKey?: string;
}

interface SendEmailResult {
    id: string | null;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("Missing RESEND_API_KEY");
    }

    const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
    };
    if (params.idempotencyKey) {
        requestHeaders["Idempotency-Key"] = params.idempotencyKey;
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({
            from: params.from,
            to: Array.isArray(params.to) ? params.to : [params.to],
            subject: params.subject,
            html: params.html,
            ...(params.replyTo ? { reply_to: params.replyTo } : {}),
            ...(params.headers && Object.keys(params.headers).length > 0
                ? { headers: params.headers }
                : {}),
        }),
    });

    if (!response.ok) {
        const payload = await response.text();
        throw new Error(`Resend error (${response.status}): ${payload}`);
    }

    const payload = await response.json().catch(() => null) as { id?: string } | null;
    return {
        id: payload?.id ?? null,
    };
}

type BatchEmailMessage = SendEmailParams;

interface BatchEmailResult {
    data: Array<{ id: string }>;
}

/**
 * Sends up to 100 messages in a single Resend Batch API call.
 * Returns the per-message ids in the same order as the input.
 * Throws on non-2xx; caller should chunk batches of >100 themselves.
 */
export async function sendEmailBatch(messages: BatchEmailMessage[]): Promise<BatchEmailResult> {
    if (messages.length === 0) return { data: [] };
    if (messages.length > 100) {
        throw new Error(`sendEmailBatch accepts at most 100 messages per call (got ${messages.length}).`);
    }
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("Missing RESEND_API_KEY");
    }

    const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(
            messages.map((m) => ({
                from: m.from,
                to: Array.isArray(m.to) ? m.to : [m.to],
                subject: m.subject,
                html: m.html,
                ...(m.replyTo ? { reply_to: m.replyTo } : {}),
                ...(m.headers && Object.keys(m.headers).length > 0 ? { headers: m.headers } : {}),
            })),
        ),
    });

    if (!response.ok) {
        const payload = await response.text();
        throw new Error(`Resend batch error (${response.status}): ${payload}`);
    }

    const payload = await response.json().catch(() => null) as { data?: Array<{ id: string }> } | null;
    return { data: payload?.data ?? [] };
}
