/**
 * Sentence-boundary-aware text splitter shared across TTS providers. The cap
 * is per-call: even providers that accept longer payloads (ElevenLabs) get
 * better latency by chunking + parallelizing.
 */
export function splitTtsText(text: string, maxChars: number): string[] {
    const cap = Math.max(50, Math.floor(maxChars));
    const trimmed = text.trim();
    if (trimmed.length === 0) return [];
    if (trimmed.length <= cap) return [trimmed];

    const sentenceRegex = /[^.!?\n]+[.!?]+|[^.!?\n]+$/g;
    const sentences = trimmed.match(sentenceRegex)?.map((s) => s.trim()).filter(Boolean) ?? [trimmed];

    const chunks: string[] = [];
    let current = "";
    const pushCurrent = () => {
        if (current.trim().length > 0) chunks.push(current.trim());
        current = "";
    };

    for (const sentence of sentences) {
        if (sentence.length > cap) {
            pushCurrent();
            const words = sentence.split(/\s+/);
            let buf = "";
            for (const word of words) {
                if (word.length > cap) {
                    if (buf) {
                        chunks.push(buf.trim());
                        buf = "";
                    }
                    for (let i = 0; i < word.length; i += cap) {
                        chunks.push(word.slice(i, i + cap));
                    }
                    continue;
                }
                if ((buf + " " + word).trim().length > cap) {
                    chunks.push(buf.trim());
                    buf = word;
                } else {
                    buf = buf ? `${buf} ${word}` : word;
                }
            }
            if (buf.trim()) chunks.push(buf.trim());
            continue;
        }

        if ((current + " " + sentence).trim().length > cap) {
            pushCurrent();
            current = sentence;
        } else {
            current = current ? `${current} ${sentence}` : sentence;
        }
    }
    pushCurrent();

    return chunks;
}

function utf8ByteLength(value: string): number {
    return new TextEncoder().encode(value).length;
}

/**
 * Split TTS input against an API byte limit instead of a character estimate.
 * Cloud TTS enforces UTF-8 bytes, so a character-only limit either wastes
 * quota on tiny chunks or still overflows for Arabic and emoji-heavy text.
 */
export function splitTtsTextByUtf8Bytes(text: string, maxBytes: number): string[] {
    const cap = Math.max(64, Math.floor(maxBytes));
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (utf8ByteLength(trimmed) <= cap) return [trimmed];

    const sentences = trimmed.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g)
        ?.map((sentence) => sentence.trim())
        .filter(Boolean) ?? [trimmed];
    const chunks: string[] = [];
    let current = "";

    const pushCurrent = () => {
        if (current.trim()) chunks.push(current.trim());
        current = "";
    };
    const appendPiece = (piece: string) => {
        const candidate = current ? `${current} ${piece}` : piece;
        if (utf8ByteLength(candidate) <= cap) {
            current = candidate;
            return;
        }
        pushCurrent();
        current = piece;
    };

    for (const sentence of sentences) {
        if (utf8ByteLength(sentence) <= cap) {
            appendPiece(sentence);
            continue;
        }

        pushCurrent();
        for (const word of sentence.split(/\s+/).filter(Boolean)) {
            if (utf8ByteLength(word) <= cap) {
                appendPiece(word);
                continue;
            }

            pushCurrent();
            let fragment = "";
            for (const codePoint of Array.from(word)) {
                if (fragment && utf8ByteLength(fragment + codePoint) > cap) {
                    chunks.push(fragment);
                    fragment = codePoint;
                } else {
                    fragment += codePoint;
                }
            }
            if (fragment) current = fragment;
        }
    }
    pushCurrent();

    return chunks;
}

export async function runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;

    async function runner(): Promise<void> {
        while (true) {
            const index = cursor++;
            if (index >= items.length) return;
            results[index] = await worker(items[index], index);
        }
    }

    const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => runner());
    await Promise.all(runners);
    return results;
}

/**
 * Run an async fn with exponential backoff. Returns null if every attempt
 * fails (rather than throwing) so multi-segment pipelines can decide whether
 * to fail-fast or proceed with a partial result.
 *
 * Default schedule: 500ms → 2s → 8s (3 attempts). Suitable for transient
 * provider 429/5xx; not for permanent input errors.
 */
export async function retryAsyncWithBackoff<R>(
    fn: () => Promise<R | null>,
    options: { attempts?: number; initialDelayMs?: number; logPrefix?: string; deadlineAt?: number } = {},
): Promise<R | null> {
    const attempts = Math.max(1, options.attempts ?? 3);
    const initialDelayMs = Math.max(0, options.initialDelayMs ?? 500);
    const logPrefix = options.logPrefix ?? "[retry]";

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        if (options.deadlineAt !== undefined && Date.now() >= options.deadlineAt) return null;
        try {
            const result = await fn();
            if (result !== null && result !== undefined) return result;
            if (attempt === attempts) return null;
        } catch (err) {
            console.warn(`${logPrefix} attempt ${attempt}/${attempts} threw:`, err instanceof Error ? err.message : err);
            if (attempt === attempts) return null;
        }
        const delay = initialDelayMs * Math.pow(4, attempt - 1);
        if (options.deadlineAt !== undefined && delay >= options.deadlineAt - Date.now()) return null;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return null;
}
