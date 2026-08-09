import Link from "next/link";
import { Cpu, ArrowUpRight } from "lucide-react";

const FOOTER_LINKS = {
    Content: [
        { href: "/blog", label: "Blog" },
        { href: "/videos", label: "Videos" },
        { href: "/newsletter", label: "Newsletter" },
        { href: "/resources", label: "Resources" },
    ],
    Company: [
        { href: "/about", label: "About" },
        { href: "/contact", label: "Contact" },
        { href: "/projects", label: "Projects" },
        { href: "/speaking", label: "Speaking" },
    ],
};

export function Footer() {
    return (
        <footer className="border-t border-border/40 bg-muted/20">
            <div className="container mx-auto max-w-6xl px-4 md:px-6">
                {/* Main Footer */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 py-16">
                    {/* Brand Column */}
                    <div className="md:col-span-5 space-y-4">
                        <Link href="/" className="flex items-center gap-2.5 group">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                <Cpu className="h-4 w-4 text-white" />
                            </div>
                            <span className="font-bold text-lg tracking-tight text-foreground">
                                Public <span className="text-violet-600">Workspace</span>
                            </span>
                        </Link>
                        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
                            Helping industry specialists become strategic orchestrators.
                            Build powerful internal tools and micro-SaaS products — no syntax required.
                        </p>
                    </div>

                    {/* Link Columns */}
                    {Object.entries(FOOTER_LINKS).map(([title, links]) => (
                        <div key={title} className="md:col-span-2 space-y-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {title}
                            </h4>
                            <ul className="space-y-2.5">
                                {links.map((link) => (
                                    <li key={link.href}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
                                        >
                                            {link.label}
                                            <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-0.5 translate-x-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* Newsletter Micro-CTA */}
                    <div className="md:col-span-3 space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Stay Updated
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            Get weekly insights on AI orchestration and vibe-coded products.
                        </p>
                        <Link
                            href="/newsletter"
                            className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors group"
                        >
                            Subscribe to newsletter
                            <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </Link>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-border/40 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                        © {new Date().getFullYear()} Public Workspace. All rights reserved.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
