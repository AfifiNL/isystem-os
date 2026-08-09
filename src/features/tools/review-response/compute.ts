import { z } from "zod";
import { toolGuardrailsSchema } from "../shared/guardrails";

export const reviewInputSchema = z.object({
    reviewText: z.string().min(8).max(2000),
    starRating: z.number().int().min(1).max(5),
    businessName: z.string().min(1).max(80),
    businessType: z.string().min(2).max(60),
    locale: z.enum(["en", "nl", "ar"]),
    reviewerName: z.string().max(60).optional(),
    tone: z.enum(["professional", "warm", "apologetic", "concise"]),
}).extend(toolGuardrailsSchema.shape);

export type ReviewInput = z.infer<typeof reviewInputSchema>;

export interface ReviewResult {
    reply: string;
    source: "ai" | "template";
    locale: "en" | "nl" | "ar";
    ratingBand: "low" | "mid" | "high";
    toneApplied: ReviewInput["tone"];
    editChecklist: string[];
    advice: string[];
}

export function getRatingBand(starRating: number): ReviewResult["ratingBand"] {
    return starRating >= 4 ? "high" : starRating === 3 ? "mid" : "low";
}

const TEMPLATES: Record<
    "en" | "nl" | "ar",
    Record<"low" | "mid" | "high", { intro: string; ack: string; close: string }>
> = {
    en: {
        high: {
            intro: "Thank you so much for the {{stars}}-star review, {{name}}!",
            ack: "We&apos;re thrilled you had a great experience at {{business}}. The {{businessType}} team puts a lot of care into every visit, and feedback like yours makes our day.",
            close: "Hope to see you again soon!",
        },
        mid: {
            intro: "Thanks for taking the time to share your feedback, {{name}}.",
            ack: "We&apos;re glad you visited {{business}} and we appreciate the honest perspective.",
            close: "If you have any specific thoughts on how we can be better, please email us — we read every note.",
        },
        low: {
            intro: "{{name}}, thank you for your feedback — and we&apos;re sorry your experience wasn&apos;t what we promise.",
            ack: "What you described isn&apos;t the standard {{business}} aims for. We&apos;d like to understand what happened and make it right.",
            close: "Please reach out so we can follow up directly.",
        },
    },
    nl: {
        high: {
            intro: "Bedankt voor de {{stars}}-sterrenrecensie, {{name}}!",
            ack: "We zijn blij dat je een fijne ervaring had bij {{business}}. Ons {{businessType}}-team werkt elke dag hard om dit waar te maken.",
            close: "We hopen je snel weer te zien!",
        },
        mid: {
            intro: "Dank je wel voor je feedback, {{name}}.",
            ack: "Fijn dat je {{business}} hebt bezocht en we waarderen je eerlijke perspectief.",
            close: "Heb je suggesties hoe we beter kunnen worden? Stuur ons gerust een mail.",
        },
        low: {
            intro: "{{name}}, bedankt voor je feedback — en het spijt ons dat je ervaring niet was wat we beloven.",
            ack: "Wat je beschrijft is niet de standaard die {{business}} nastreeft. We willen graag begrijpen wat er gebeurd is en het rechtzetten.",
            close: "Neem contact op zodat we het direct kunnen oppakken.",
        },
    },
    ar: {
        high: {
            intro: "شكرًا جزيلًا على تقييم {{stars}} نجوم يا {{name}}!",
            ack: "يسعدنا أنك حظيت بتجربة رائعة في {{business}}. فريق {{businessType}} يبذل قصارى جهده مع كل عميل.",
            close: "نتطلّع لرؤيتك مجدّدًا قريبًا!",
        },
        mid: {
            intro: "شكرًا على وقتك ومشاركتك رأيك يا {{name}}.",
            ack: "سعداء بزيارتك لـ {{business}} ونقدّر صراحتك.",
            close: "إن كان لديك ملاحظات محدّدة لتحسين الخدمة فيُسعدنا الاستماع.",
        },
        low: {
            intro: "{{name}}، شكرًا على ملاحظاتك — ونعتذر إن لم ترقَ التجربة لما نَعِد به.",
            ack: "ما وصفتَه لا يُمثّل المستوى الذي يسعى إليه {{business}}. نودّ فهم ما حدث وتصحيحه.",
            close: "تواصل معنا مباشرة وسنتابع الأمر شخصيًا.",
        },
    },
};

function fillTemplate(t: string, ctx: Record<string, string>): string {
    return t.replace(/\{\{(\w+)\}\}/g, (_, k) => ctx[k] ?? "");
}

export function buildTemplateReply(input: ReviewInput): string {
    const bucket = getRatingBand(input.starRating);
    const template = TEMPLATES[input.locale][bucket];
    const ctx = {
        name: input.reviewerName?.trim() || (input.locale === "ar" ? "صديقنا" : "there"),
        business: input.businessName,
        businessType: input.businessType,
        stars: String(input.starRating),
    };
    return [fillTemplate(template.intro, ctx), fillTemplate(template.ack, ctx), fillTemplate(template.close, ctx)].join("\n\n");
}

export function buildEditChecklist(input: ReviewInput): string[] {
    const checklist = [
        "Confirm the reply does not admit liability or promise compensation.",
        "Add a real contact channel before posting if the rating is 1-2 stars.",
        "Personalize one sentence with a detail from the review before publishing.",
    ];
    if (input.locale === "nl") checklist.push("Keep the Dutch tone direct and modest; avoid over-apologizing.");
    if (input.locale === "ar") checklist.push("Use a respectful Modern Standard Arabic register unless your brand voice is dialectal.");
    if (input.tone === "concise") checklist.push("Trim to 2-4 sentences for a concise public response.");
    return checklist;
}

export function buildAdvice(input: ReviewInput): string[] {
    const advice: string[] = [];
    if (input.starRating <= 2) {
        advice.push("Reply within 24h — Google weights review velocity in local pack rankings.");
        advice.push("Take it offline: ask the reviewer to email/call so the public exchange stays short and professional.");
    }
    if (input.starRating === 3) {
        advice.push("Three-star reviews are an opportunity — public follow-up shows future customers you act on feedback.");
    }
    if (input.starRating >= 4) {
        advice.push("Use this momentum: trigger a request-for-review SMS to 3 other recent customers today.");
    }
    if (input.reviewText.toLowerCase().includes("price") || input.reviewText.toLowerCase().includes("expensive")) {
        advice.push("Price complaints often signal a value-communication gap — review your pricing page copy.");
    }
    return advice;
}
