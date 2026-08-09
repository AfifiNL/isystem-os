"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Loader2, MessageSquare, Star } from "lucide-react";
import { runReviewResponse } from "./actions";
import { ToolUnlockModal } from "../shared/ui/ToolUnlockModal";
import { useToolUnlock } from "../shared/use-tool-unlock";
import type { ReviewInput, ReviewResult } from "./compute";
import {
    ToolField,
    ToolInput,
    ToolPanel,
    ToolPrimaryButton,
    ToolResultCallout,
    ToolSegmented,
    ToolSelect,
    ToolTextarea,
} from "../shared/ui/primitives";
import { HoneypotField, useFormStartedAt } from "../shared/ui/anti-abuse-fields";
import { getToolClientStrings } from "../shared/client-i18n";
import type { ToolLocale } from "../shared/types";

export function ReviewResponseClient({ locale }: { locale: ToolLocale }) {
    const t = getToolClientStrings(locale);
    const [form, setForm] = useState<ReviewInput>({
        reviewText: "",
        starRating: 5,
        businessName: "",
        businessType: "",
        locale: "en",
        reviewerName: "",
        tone: "warm",
    });
    const [result, setResult] = useState<ReviewResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [copied, setCopied] = useState(false);
    const [honeypot, setHoneypot] = useState("");
    const formStartedAt = useFormStartedAt();

    const unlock = useToolUnlock(runReviewResponse);

    function processResult(res: Awaited<ReturnType<typeof runReviewResponse>>) {
        if (!res.ok || !res.data) {
            if (!res.requiresSubscription) setError(res.error ?? "Could not generate reply.");
            return;
        }
        setError(null);
        setResult(res.data.result);
    }

    useEffect(() => unlock.onResult(processResult), [unlock]);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const res = await unlock.run({ ...form, website: honeypot, formStartedAt });
            processResult(res);
        });
    }

    async function copyToClipboard() {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.reply);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }

    return (
        <div className="space-y-6">
            <ToolUnlockModal
                open={unlock.modalOpen}
                tool="review-response-generator"
                toolName="Review Response Generator"
                locale={locale}
                onClose={unlock.closeModal}
                onUnlocked={unlock.retryAfterUnlock}
            />
            <ToolPanel hideOnPrint>
                <form onSubmit={submit} className="relative space-y-5">
                    <HoneypotField value={honeypot} onChange={setHoneypot} />
                    <ToolField label="Review text" htmlFor="review-text">
                        <ToolTextarea
                            id="review-text"
                            value={form.reviewText}
                            onChange={(e) => setForm({ ...form, reviewText: e.target.value })}
                            rows={5}
                            minLength={8}
                            maxLength={2000}
                            required
                            placeholder="Paste the customer's review here…"
                        />
                        <span className="mt-1 block text-[11px] text-slate-500">{form.reviewText.length}/2000</span>
                    </ToolField>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <ToolField label="Rating">
                            <div className="flex gap-1.5">
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setForm({ ...form, starRating: n })}
                                        aria-label={`${n} stars`}
                                        className={`flex h-11 flex-1 items-center justify-center rounded-xl border transition ${
                                            form.starRating >= n
                                                ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.25)]"
                                                : "border-white/15 bg-white/5 text-slate-400 hover:border-cyan-300/40"
                                        }`}
                                    >
                                        <Star className={`size-4 ${form.starRating >= n ? "fill-cyan-300" : ""}`} aria-hidden />
                                    </button>
                                ))}
                            </div>
                        </ToolField>
                        <ToolField label="Language">
                            <ToolSelect
                                value={form.locale}
                                onChange={(e) => setForm({ ...form, locale: e.target.value as ReviewInput["locale"] })}
                            >
                                <option value="en">English</option>
                                <option value="nl">Nederlands</option>
                                <option value="ar">العربية</option>
                            </ToolSelect>
                        </ToolField>
                        <ToolField label="Tone">
                            <ToolSegmented
                                value={form.tone}
                                onChange={(v) => setForm({ ...form, tone: v })}
                                options={[
                                    { value: "warm", label: "Warm" },
                                    { value: "professional", label: "Pro" },
                                    { value: "apologetic", label: "Apol" },
                                    { value: "concise", label: "Concise" },
                                ]}
                            />
                        </ToolField>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <ToolField label="Your business name">
                            <ToolInput
                                type="text"
                                required
                                value={form.businessName}
                                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                                maxLength={80}
                            />
                        </ToolField>
                        <ToolField label="Business type">
                            <ToolInput
                                type="text"
                                required
                                value={form.businessType}
                                onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                                placeholder="dental clinic, agency, restaurant…"
                                maxLength={60}
                            />
                        </ToolField>
                        <ToolField label="Reviewer first name" helper="Optional">
                            <ToolInput
                                type="text"
                                value={form.reviewerName}
                                onChange={(e) => setForm({ ...form, reviewerName: e.target.value })}
                                maxLength={60}
                            />
                        </ToolField>
                    </div>
                    {error ? (
                        <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>
                    ) : null}
                    <ToolPrimaryButton
                        type="submit"
                        disabled={pending}
                        iconLeft={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MessageSquare className="size-4" aria-hidden />}
                    >
                        {pending ? t.drafting : t.generateReply}
                    </ToolPrimaryButton>
                </form>
            </ToolPanel>

            {result ? (
                <>
                    <ToolResultCallout
                        eyebrow="Suggested reply"
                        headline={result.source === "ai" ? "AI-generated · review before posting" : "Template fallback · AI temporarily unavailable"}
                    >
                        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 print:border-slate-300 print:bg-white">
                            <p
                                className="whitespace-pre-line text-sm leading-relaxed text-slate-100 print:text-slate-900"
                                dir={result.locale === "ar" ? "rtl" : "ltr"}
                            >
                                {result.reply}
                            </p>
                            <button
                                type="button"
                                onClick={copyToClipboard}
                                className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 text-xs font-medium text-white hover:border-cyan-400/40 hover:bg-white/10 print:hidden"
                            >
                                <Copy className="size-3.5" aria-hidden /> {copied ? "Copied" : "Copy reply"}
                            </button>
                        </div>
                    </ToolResultCallout>

                    {result.advice.length ? (
                        <ToolPanel>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Pro tips for this rating</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-300">
                                {result.advice.map((line, i) => <li key={i}>· {line}</li>)}
                            </ul>
                        </ToolPanel>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
