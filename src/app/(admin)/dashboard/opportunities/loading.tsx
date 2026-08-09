export default function OpportunitiesLoading() {
    return (
        <div className="flex flex-col gap-6">
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            <div className="h-4 w-[420px] max-w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-40 animate-pulse rounded bg-muted" />
            <div className="grid gap-4">
                {[0, 1, 2].map((key) => (
                    <div key={key} className="h-40 animate-pulse rounded-xl bg-muted" />
                ))}
            </div>
        </div>
    );
}
