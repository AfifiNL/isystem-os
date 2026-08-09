export async function mapWithBoundedConcurrency<T, R>(
    values: readonly T[],
    maxConcurrency: number,
    mapper: (value: T, index: number) => Promise<R>,
    options: { stopWhen?: (result: R) => boolean } = {},
): Promise<R[]> {
    if (values.length === 0) return [];

    const concurrency = Math.max(1, Math.min(values.length, Math.floor(maxConcurrency)));
    const results = new Array<R>(values.length);
    let nextIndex = 0;
    let stopped = false;
    let stopResult: R | undefined;

    const worker = async () => {
        while (!stopped && nextIndex < values.length) {
            const index = nextIndex;
            nextIndex += 1;
            const result = await mapper(values[index], index);
            results[index] = result;
            if (options.stopWhen?.(result)) {
                stopped = true;
                stopResult = result;
            }
        }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    if (stopped) {
        for (let index = 0; index < results.length; index += 1) {
            if (!(index in results)) results[index] = stopResult as R;
        }
    }
    return results;
}

let activeGlobalTasks = 0;
const globalWaiters: Array<() => void> = [];

export async function withGlobalConcurrencyPermit<T>(
    maxConcurrency: number,
    task: () => Promise<T>,
    options: { deadlineAt?: number } = {},
): Promise<T> {
    const limit = Math.max(1, Math.floor(maxConcurrency));
    if (activeGlobalTasks >= limit) {
        const remainingMs = (options.deadlineAt ?? Number.POSITIVE_INFINITY) - Date.now();
        if (remainingMs <= 0) throw new DOMException("Provider concurrency wait timed out.", "TimeoutError");

        await new Promise<void>((resolve, reject) => {
            let timeout: ReturnType<typeof setTimeout> | undefined;
            const grant = () => {
                if (timeout) clearTimeout(timeout);
                activeGlobalTasks += 1;
                resolve();
            };
            globalWaiters.push(grant);
            if (Number.isFinite(remainingMs)) {
                timeout = setTimeout(() => {
                    const waiterIndex = globalWaiters.indexOf(grant);
                    if (waiterIndex >= 0) globalWaiters.splice(waiterIndex, 1);
                    reject(new DOMException("Provider concurrency wait timed out.", "TimeoutError"));
                }, remainingMs);
            }
        });
    } else {
        activeGlobalTasks += 1;
    }

    try {
        return await task();
    } finally {
        activeGlobalTasks -= 1;
        globalWaiters.shift()?.();
    }
}
