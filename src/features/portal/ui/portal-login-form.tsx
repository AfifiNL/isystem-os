"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { portalLogin } from "@/features/portal/actions/auth";
import { Loader2, ArrowRight, ShieldCheck, Mail, Lock } from "lucide-react";
import { DEFAULT_LOCALE, getLocaleFromPathname } from "@/shared/lib/i18n/routing";
import type { Locale } from "@/features/templates/types";

const COPY: Record<Locale, {
    title: string;
    badge: string;
    intro: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    submitIdle: string;
    submitPending: string;
    securityNotice: string;
    error: string;
}> = {
    en: {
        title: "Partner Portal",
        badge: "Invite only",
        intro: "Sign in to follow your delivery scopes, service levels, and recent bookings.",
        emailLabel: "Email Address",
        emailPlaceholder: "Enter your email",
        passwordLabel: "Password",
        submitIdle: "Sign in",
        submitPending: "Signing in...",
        securityNotice: "Secure workspace access",
        error: "That email and password didn't match. Please try again.",
    },
    nl: {
        title: "Partner Portal",
        badge: "Alleen op uitnodiging",
        intro: "Log in om uw opdrachten, serviceniveaus en recente boekingen te volgen.",
        emailLabel: "E-mailadres",
        emailPlaceholder: "Voer uw e-mail in",
        passwordLabel: "Wachtwoord",
        submitIdle: "Inloggen",
        submitPending: "Bezig met inloggen...",
        securityNotice: "Veilige toegang tot de werkruimte",
        error: "Dit e-mailadres en wachtwoord komen niet overeen. Probeer het opnieuw.",
    },
    ar: {
        title: "بوابة الشريك",
        badge: "بدعوة فقط",
        intro: "سجّل الدخول لمتابعة نطاقات التنفيذ ومستويات الخدمة والحجوزات الأخيرة.",
        emailLabel: "البريد الإلكتروني",
        emailPlaceholder: "أدخل بريدك الإلكتروني",
        passwordLabel: "كلمة المرور",
        submitIdle: "تسجيل الدخول",
        submitPending: "جارٍ تسجيل الدخول...",
        securityNotice: "وصول آمن إلى مساحة العمل",
        error: "البريد الإلكتروني وكلمة المرور غير متطابقين. يرجى المحاولة مرة أخرى.",
    },
};

export function PortalLoginForm() {
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);
    const pathname = usePathname() || "/";
    const locale = getLocaleFromPathname(pathname) ?? DEFAULT_LOCALE;
    const t = COPY[locale];

    const handleFormAction = async (formData: FormData) => {
        setIsPending(true);
        setError(null);

        const res = await portalLogin(formData);

        if (res?.error) {
            setError(t.error);
        }
        setIsPending(false);
    };

    return (
        <div className="w-full max-w-md">
            {/* Header */}
            <div className="mb-10 text-center">
                 <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_40px_-10px_rgba(74,144,226,0.3)]">
                    <ShieldCheck className="h-8 w-8 text-[#4A90E2]" />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">{t.title}</h1>
                <p className="text-sm font-medium text-[#4A90E2] uppercase tracking-widest">{t.badge}</p>
                <p className="mt-4 text-sm text-slate-400">{t.intro}</p>
            </div>

            {/* Form Card */}
            <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
                {/* Subtle top highlight */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#4A90E2] to-transparent opacity-50" />

                <form
                    id="portal-auth-form"
                    className="space-y-6"
                    action={handleFormAction}
                >
                    <input type="hidden" name="locale" value={locale} />
                    {error && (
                        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4">
                            <p className="text-sm font-medium text-red-500">{error}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                {t.emailLabel}
                            </label>
                            <div className="relative">
                                <Mail className="absolute start-3 top-3 h-4 w-4 text-slate-500" />
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder={t.emailPlaceholder}
                                    required
                                    dir="auto"
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-none ps-10 pe-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#4A90E2] focus:border-[#4A90E2] transition-colors"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    {t.passwordLabel}
                                </label>
                            </div>
                            <div className="relative">
                                <Lock className="absolute start-3 top-3 h-4 w-4 text-slate-500" />
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="••••••••••••"
                                    required
                                    dir="auto"
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-none ps-10 pe-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#4A90E2] focus:border-[#4A90E2] transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isPending}
                        className="group relative flex w-full items-center justify-center gap-2 bg-[#002f58] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#0d4f8c] disabled:opacity-70"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t.submitPending}
                            </>
                        ) : (
                            <>
                                {t.submitIdle}
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl-flip" />
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
                <span className="text-xs text-slate-500">{t.securityNotice}</span>
            </div>
        </div>
    );
}
