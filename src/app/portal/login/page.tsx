import { PortalLoginForm } from "@/features/portal/ui/portal-login-form";

export const metadata = {
    title: "Partner Login | Workspace",
    description: "Secure partner access for workspace, portal, and operations tracking.",
};

export default function PortalLoginPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#4A90E2] opacity-[0.12] blur-[120px]" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-[600px] w-[600px] rounded-full bg-[#002f58] opacity-[0.25] blur-[150px]" />
            <div className="pointer-events-none absolute top-1/2 left-0 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-slate-800 opacity-20 blur-[100px]" />
            
            <div className="relative z-10 w-full flex justify-center">
                <PortalLoginForm />
            </div>
            
            {/* Minimal Grid Overlay */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)]" />
        </div>
    );
}
