const skeletonRows = Array.from({length: 5}, (_, i) => i);

export function MatchHistorySkeleton() {
    return (
        <section className="space-y-3" aria-hidden="true">
            {/* Summary skeleton */}
            <div className="rounded-md border bg-card px-4 py-3">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 animate-pulse rounded bg-muted"/>
                        <div className="space-y-1.5">
                            <div className="h-4 w-24 animate-pulse rounded bg-muted"/>
                            <div className="h-3 w-36 animate-pulse rounded bg-muted"/>
                        </div>
                    </div>
                    <div className="flex gap-6">
                        <div className="h-4 w-20 animate-pulse rounded bg-muted"/>
                        <div className="h-4 w-16 animate-pulse rounded bg-muted"/>
                        <div className="h-4 w-20 animate-pulse rounded bg-muted"/>
                    </div>
                </div>
            </div>

            {/* Row skeletons */}
            <div className="space-y-2">
                {skeletonRows.map((row) => (
                    <div
                        key={row}
                        className="flex items-center gap-3 rounded-md border border-l-[3px] border-l-muted bg-card px-3 py-2"
                    >
                        <div className="h-10 w-10 animate-pulse rounded-md bg-muted"/>
                        <div className="flex flex-col gap-0.5">
                            <div className="h-[18px] w-[18px] animate-pulse rounded bg-muted"/>
                            <div className="h-[18px] w-[18px] animate-pulse rounded bg-muted"/>
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <div className="h-4 w-28 animate-pulse rounded bg-muted"/>
                            <div className="h-3 w-40 animate-pulse rounded bg-muted"/>
                        </div>
                        <div className="flex gap-1">
                            {Array.from({length: 7}, (_, i) => (
                                <div
                                    key={i}
                                    className="h-6 w-6 animate-pulse rounded bg-muted"
                                />
                            ))}
                        </div>
                        <div className="h-3 w-16 animate-pulse rounded bg-muted"/>
                    </div>
                ))}
            </div>
        </section>
    );
}
