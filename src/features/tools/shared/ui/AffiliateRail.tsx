import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getAffiliatesForTool } from "../affiliates";
import { getToolsChrome } from "../i18n";
import type { ToolLocale, ToolSlug } from "../types";

interface AffiliateRailProps {
    slug: ToolSlug;
    locale: ToolLocale;
    heading?: string;
    subheading?: string;
}

export function AffiliateRail({ slug, locale, heading, subheading }: AffiliateRailProps) {
    const links = getAffiliatesForTool(slug);
    if (links.length === 0) return null;
    const chrome = getToolsChrome(locale);
    return (
        <section className="mt-14 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-[0_30px_80px_rgba(0,15,40,0.4)] backdrop-blur-xl sm:p-8">
            <header className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{chrome.affiliate.eyebrow}</p>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-white">{heading ?? chrome.affiliate.heading}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{subheading ?? chrome.affiliate.subheading}</p>
            </header>
            <ul className="grid gap-3 sm:grid-cols-2">
                {links.map((link) => (
                    <li key={link.id}>
                        <Link
                            href={link.url}
                            target="_blank"
                            rel="sponsored nofollow noopener"
                            className="group flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-cyan-400/40 hover:bg-white/10"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{link.label}</p>
                                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{link.description}</p>
                            </div>
                            <ArrowUpRight className="size-4 shrink-0 text-slate-400 group-hover:text-cyan-300" aria-hidden />
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
