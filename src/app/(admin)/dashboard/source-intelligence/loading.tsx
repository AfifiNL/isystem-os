export default function SourceIntelligenceLoading() {
    return (
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-6">
            <div className="h-56 animate-pulse rounded-[2rem] border border-white/10 bg-slate-900/70" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-slate-900/70" />)}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
                <div className="h-96 animate-pulse rounded-2xl border border-white/10 bg-slate-900/70" />
                <div className="h-96 animate-pulse rounded-2xl border border-white/10 bg-slate-900/70" />
            </div>
        </div>
    );
}
