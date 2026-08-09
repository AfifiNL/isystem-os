export interface ManualDocumentExtractionInput {
    documentId: string;
    text: string;
    language?: string;
    pageCount?: number;
}

export interface ExtractedLegalSignal {
    kind: "payment" | "renewal" | "notice" | "dpa_breach" | "governing_law";
    title: string;
    sourceQuote: string;
}

const SIGNAL_PATTERNS: Array<{ kind: ExtractedLegalSignal["kind"]; title: string; regex: RegExp }> = [
    { kind: "payment", title: "Payment term", regex: /(?:betaling|payment).{0,80}(?:\d{1,3})\s*(?:dagen|days)/i },
    { kind: "renewal", title: "Renewal or extension", regex: /(?:verleng|renew|extension|automatisch).{0,120}/i },
    { kind: "notice", title: "Notice period", regex: /(?:opzegtermijn|notice period).{0,120}/i },
    { kind: "dpa_breach", title: "DPA breach notification", regex: /(?:datalek|personal data breach|breach).{0,120}(?:72|tweeënzeventig|seventy-two)/i },
    { kind: "governing_law", title: "Governing law", regex: /(?:Nederlands recht|Dutch law|governing law).{0,120}/i },
];

export function extractLegalSignals(text: string): ExtractedLegalSignal[] {
    return SIGNAL_PATTERNS.flatMap((pattern) => {
        const match = text.match(pattern.regex);
        if (!match?.[0]) return [];
        return [{ kind: pattern.kind, title: pattern.title, sourceQuote: match[0].trim() }];
    });
}
