import { normalizeEmailLocale } from "@/features/communications/email-lifecycle";

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function buildInquiryAcknowledgement(input: {
    locale?: string | null;
    workspaceName: string;
    customerName: string;
}) {
    const locale = normalizeEmailLocale(input.locale);
    const copy = {
        en: {
            subject: `We received your inquiry · ${input.workspaceName}`,
            headline: `Thanks, ${input.customerName}. Your message is with us.`,
            body: "A member of our team will review your request and reply personally. This operational confirmation does not subscribe you to marketing emails.",
        },
        nl: {
            subject: `We hebben uw aanvraag ontvangen · ${input.workspaceName}`,
            headline: `Bedankt, ${input.customerName}. Uw bericht is goed ontvangen.`,
            body: "Een teamlid beoordeelt uw aanvraag en reageert persoonlijk. Deze ontvangstbevestiging schrijft u niet in voor marketingmails.",
        },
        ar: {
            subject: `استلمنا طلبك · ${input.workspaceName}`,
            headline: `شكرًا ${input.customerName}، لقد استلمنا رسالتك.`,
            body: "سيراجع أحد أعضاء فريقنا طلبك ويرد عليك شخصيًا. رسالة التأكيد التشغيلية هذه لا تشترك بك في الرسائل التسويقية.",
        },
    }[locale];

    return {
        subject: copy.subject,
        html: `<!doctype html><html lang="${locale}"><body style="margin:0;padding:24px;background:#f6f7f9;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="560" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;">
<tr><td style="padding:28px;" dir="${locale === "ar" ? "rtl" : "ltr"}">
<p style="margin:0 0 6px;color:#64748b;font-size:12px;">${escapeHtml(input.workspaceName)}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;">${escapeHtml(copy.headline)}</h1>
<p style="margin:0;font-size:15px;line-height:1.65;color:#334155;">${escapeHtml(copy.body)}</p>
</td></tr></table></body></html>`,
    };
}

export function buildManagerInquiryEmail(input: {
    workspaceName: string;
    name: string;
    email: string;
    company?: string;
    phone?: string;
    requestType?: string;
    timeline?: string;
    challenge?: string;
    dashboardUrl: string;
}) {
    const row = (label: string, value?: string) => value
        ? `<tr><td style="padding:6px 0;width:120px;font-weight:600;color:#64748b;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#0f172a;">${escapeHtml(value)}</td></tr>`
        : "";
    return {
        subject: `New inquiry from ${input.name} · ${input.company || "Contact form"}`,
        html: `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f7f9;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="560" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;"><tr><td style="padding:28px;">
<p style="margin:0 0 4px;color:#64748b;font-size:11px;letter-spacing:.18em;text-transform:uppercase;">${escapeHtml(input.workspaceName)} · Lead intake</p>
<h1 style="margin:0 0 16px;font-size:20px;">New contact inquiry</h1>
<table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse;">
${row("Name", input.name)}${row("Email", input.email)}${row("Company", input.company)}${row("Phone", input.phone)}${row("Interest", input.requestType)}${row("Timeline", input.timeline)}${row("Message", input.challenge)}
</table>
<p style="margin:24px 0 0;"><a href="${escapeHtml(input.dashboardUrl)}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#0f172a;color:#fff;text-decoration:none;font-weight:600;">Open lead inbox</a></p>
</td></tr></table></body></html>`,
    };
}
