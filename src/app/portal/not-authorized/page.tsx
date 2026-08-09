import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export const metadata = {
    title: "Access Restricted | Partner Portal",
};

export default function NotAuthorizedPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 relative overflow-hidden text-center">
            {/* Ambient Background Glows */}
            <div className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-900 opacity-[0.15] blur-[120px]" />
            
            <div className="relative z-10 w-full max-w-md">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_40px_-10px_rgba(220,38,38,0.2)]">
                    <ShieldAlert className="h-10 w-10 text-red-500" />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Access Restricted</h1>
                <p className="mt-4 text-sm text-slate-400 leading-relaxed">
                    You do not currently have any active workspace access assigned to this account. Please contact your administrator or delivery lead to provision your portal access.
                </p>
                
                <div className="mt-8 flex justify-center gap-4">
                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center gap-2 border border-slate-800 bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:border-slate-700"
                    >
                        Switch Account
                    </Link>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 bg-[#002f58] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#0d4f8c]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Homepage
                    </Link>
                </div>
            </div>
            
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)]" />
        </div>
    );
}
