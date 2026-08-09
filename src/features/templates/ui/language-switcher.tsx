"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { useTemplate } from "@/features/templates/template-provider";
import { setLocale } from "@/features/templates/actions";
import { resolveBlogLocaleSwitchHref } from "@/features/blog/actions";
import { resolvePodcastLocaleSwitchHref } from "@/features/podcast/public-actions";
import { resolveVideoLocaleSwitchHref } from "@/features/video-stream/public-actions";
import {
    getLocaleNativeLabel,
    localizeHref,
    stripLocaleFromPathname,
} from "@/shared/lib/i18n/routing";
import type { Locale } from "@/features/templates/types";

const SHORT_LABEL: Record<Locale, string> = {
    en: "EN",
    nl: "NL",
    ar: "AR",
};

export function LanguageSwitcher() {
    const { config, locale, supportedLocales } = useTemplate();
    const [isPending, startTransition] = useTransition();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const isLightPublicTheme = config.appearance?.defaultMode === "light";
    const triggerTextClass = isLightPublicTheme ? "text-[var(--template-text-primary)]" : "text-[var(--template-text-inverse)]";
    const dropdownClass = isLightPublicTheme
        ? "border-[var(--template-border-soft)] bg-[oklch(0.982_0.014_248)] text-[var(--template-text-primary)] shadow-[0_18px_48px_rgba(12,24,42,0.16)]"
        : "border-[var(--template-border-inverse)] [background:var(--template-surface-inverse-raised)] text-[var(--template-text-inverse)] shadow-[var(--template-depth-md)]";
    const activeItemClass = isLightPublicTheme
        ? "bg-[color-mix(in_oklch,var(--template-accent)_14%,oklch(0.982_0.014_248))] text-[var(--template-text-primary)]"
        : "bg-[color-mix(in_oklch,var(--template-accent)_12%,transparent)] text-[var(--template-text-inverse)]";
    const inactiveItemClass = isLightPublicTheme
        ? "text-[var(--template-text-secondary)] hover:bg-[color-mix(in_oklch,var(--template-primary)_8%,oklch(0.982_0.014_248))] hover:text-[var(--template-text-primary)]"
        : "text-[var(--template-text-inverse-muted)] hover:bg-white/5 hover:text-[var(--template-text-inverse)]";

    useEffect(() => {
        if (!open) return;
        function handleClickOutside(event: MouseEvent) {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(event.target as Node)) setOpen(false);
        }
        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open]);

    const switchTo = (next: Locale) => {
        if (next === locale) {
            setOpen(false);
            return;
        }
        const basePathname = stripLocaleFromPathname(pathname || "/");
        const queryString = searchParams.toString();
        const hash = typeof window !== "undefined" ? window.location.hash : "";

        startTransition(async () => {
            let targetPathname = null;
            if (basePathname === "/blog" || basePathname.startsWith("/blog/")) {
                targetPathname = await resolveBlogLocaleSwitchHref({ pathname: pathname || "/", nextLocale: next });
            } else if (basePathname === "/podcast" || basePathname.startsWith("/podcast/")) {
                targetPathname = await resolvePodcastLocaleSwitchHref({ pathname: pathname || "/", nextLocale: next });
            } else if (basePathname === "/videos" || basePathname.startsWith("/videos/")) {
                targetPathname = await resolveVideoLocaleSwitchHref({ pathname: pathname || "/", nextLocale: next });
            }
            const localizedPathname = targetPathname ?? localizeHref(next, basePathname);
            const targetHref = `${localizedPathname}${queryString ? `?${queryString}` : ""}${hash}`;

            await setLocale(next);
            // Force a full page reload so every RSC payload, dictionary, and
            // server-rendered string is fetched fresh in the new locale.
            window.location.assign(targetHref);
        });
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                disabled={isPending}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${triggerTextClass}
                    ${isPending ? "opacity-50 cursor-wait" : isLightPublicTheme ? "hover:bg-[color-mix(in_oklch,var(--template-primary)_8%,transparent)] cursor-pointer" : "hover:bg-white/10 cursor-pointer"}
                `}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label="Switch language"
            >
                <span>{SHORT_LABEL[locale]}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open ? (
                <ul
                    role="listbox"
                    aria-label="Language"
                    className={`absolute end-0 top-full mt-1 z-[90] min-w-[160px] rounded-xl border p-1 backdrop-blur-[22px] ${dropdownClass}`}
                >
                    {supportedLocales.map((option) => {
                        const isActive = option === locale;
                        return (
                            <li key={option} role="option" aria-selected={isActive}>
                                <button
                                    type="button"
                                    onClick={() => switchTo(option)}
                                    disabled={isPending}
                                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? activeItemClass : inactiveItemClass}`}
                                    lang={option}
                                    dir={option === "ar" ? "rtl" : "ltr"}
                                >
                                    <span>{getLocaleNativeLabel(option)}</span>
                                    {isActive ? <Check className="h-3.5 w-3.5" /> : null}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
}
